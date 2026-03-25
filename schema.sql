-- ============================================================
-- 프리미어 프로 원데이 클래스 & 디지털 상점 — Supabase DB 스키마
-- Supabase SQL Editor에 붙여넣어 실행하세요.
-- ============================================================

-- ① Users (프로필 테이블 — auth.users 와 1:1 연동)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  provider   text,           -- 'kakao' | 'naver' | 'google'
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- auth.users 가입 시 자동으로 public.users 행 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ② Products (상품 테이블)
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null check (type in ('class', 'digital_asset')),
  price         integer not null default 0,
  category      text,
  description   text,
  thumbnail_url text,
  detail_images text[] default '{}',                             -- 상세페이지 이미지 URL 배열
  file_url      text,
  sort_order    integer not null default 0,                       -- 진열 순서 (낮을수록 앞)
  created_at    timestamptz default now()
);

alter table public.products enable row level security;

create policy "Products are publicly readable"
  on public.products for select
  using (true);

-- 관리자: 상품 등록/수정/삭제
create policy "Admins can insert products"
  on public.products for insert
  with check (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

create policy "Admins can update products"
  on public.products for update
  using (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

create policy "Admins can delete products"
  on public.products for delete
  using (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

-- 테이블 접근 권한 부여 (RLS와 별개로 필요)
grant all on public.products to anon, authenticated;


-- ③ Orders (주문/결제 테이블 — 클래스+샵 통합)
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  product_id       uuid references public.products(id) on delete cascade,
  order_type       text not null default 'class' check (order_type in ('class', 'shop')),  -- 주문 유형
  total_amount     integer not null default 0,                    -- 총 결제 금액
  class_name       text,                                          -- 클래스명 (예: 감성 브이로그 반)
  schedule         text,                                          -- 선택 일정
  name             text,                                          -- 주문자 이름
  phone            text,                                          -- 휴대폰 번호
  experience_level text,                                          -- 영상 편집 경험
  message          text,                                          -- 하고 싶은 말 (선택)
  payment_method   text check (payment_method in ('card', 'bank_transfer', 'free')),  -- 결제 수단
  depositor_name       text,                                      -- 입금자명 (계좌이체 시)
  cash_receipt_number  text,                                      -- 현금영수증 번호 (계좌이체 시)
  toss_order_id        text,                                      -- 토스페이먼츠 주문번호
  toss_payment_key     text,                                      -- 토스페이먼츠 결제키
  status               text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  paid_at              timestamptz,
  created_at           timestamptz default now()
);

alter table public.orders enable row level security;

-- 일반 유저: 본인 주문만 읽기/쓰기
create policy "Users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- 관리자(Admin): 모든 주문 읽기 및 상태 업데이트
create policy "Admins can read all orders"
  on public.orders for select
  using (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

create policy "Admins can update all orders"
  on public.orders for update
  using (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

-- 테이블 접근 권한 부여 (RLS와 별개로 필요)
grant all on public.orders to anon, authenticated;
grant all on public.users to anon, authenticated;


-- ④ Cart_Items (장바구니 테이블)
create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, product_id)                                     -- 같은 상품 중복 방지
);

alter table public.cart_items enable row level security;

create policy "Users can read own cart"
  on public.cart_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own cart"
  on public.cart_items for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own cart"
  on public.cart_items for delete
  using (auth.uid() = user_id);

grant all on public.cart_items to anon, authenticated;


-- ⑤ Order_Items (주문 상세 항목 — 한 주문에 여러 상품)
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price      integer not null default 0,                          -- 결제 당시 가격 스냅샷
  created_at timestamptz default now()
);

alter table public.order_items enable row level security;

-- order_items는 orders를 통해 접근 제어 (본인 주문 항목만 조회)
create policy "Users can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

-- 관리자: 모든 주문 항목 조회
create policy "Admins can read all order items"
  on public.order_items for select
  using (
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

grant all on public.order_items to anon, authenticated;

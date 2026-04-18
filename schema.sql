-- قاعدة بيانات Supabase لنظام مركز البدر
-- يجب تنفيذ هذا الملف في لوحة تحكم Supabase

-- تمكين RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- إنشاء جداول قاعدة البيانات
CREATE TABLE public.activity_log (
  id bigint NOT NULL DEFAULT nextval('activity_log_id_seq'::regclass),
  user_id uuid,
  activity_type text NOT NULL,
  table_name text NOT NULL,
  record_id bigint,
  old_values jsonb,
  new_values jsonb,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  CONSTRAINT activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.app_settings (
  id bigint NOT NULL DEFAULT nextval('app_settings_id_seq'::regclass),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.batch_sale_items (
  id bigint NOT NULL DEFAULT nextval('batch_sale_items_id_seq'::regclass),
  sale_item_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  quantity_sold integer NOT NULL CHECK (quantity_sold > 0),
  price_used numeric NOT NULL CHECK (price_used >= 0::numeric),
  batch_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batch_sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT batch_sale_items_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id),
  CONSTRAINT batch_sale_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id)
);

CREATE TABLE public.credit_payments (
  id integer NOT NULL DEFAULT nextval('credit_payments_id_seq'::regclass),
  credit_id integer NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  payment_method character varying NOT NULL DEFAULT 'نقدي'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_payments_pkey PRIMARY KEY (id),
  CONSTRAINT credit_payments_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.customer_credits(id)
);

CREATE TABLE public.customer_credits (
  id integer NOT NULL DEFAULT nextval('customer_credits_id_seq'::regclass),
  customer_id integer NOT NULL,
  sale_id integer NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  status character varying NOT NULL DEFAULT 'مفتوح'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_credits_pkey PRIMARY KEY (id),
  CONSTRAINT customer_credits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_credits_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);

CREATE TABLE public.customers (
  id bigint NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
  name text NOT NULL CHECK (length(TRIM(BOTH FROM name)) > 0),
  phone text NOT NULL CHECK (length(TRIM(BOTH FROM phone)) > 0),
  email text,
  address text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.categories (
  id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name text NOT NULL CHECK (length(TRIM(BOTH FROM name)) > 0),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.product_batches (
  id bigint NOT NULL DEFAULT nextval('product_batches_id_seq'::regclass),
  product_id bigint NOT NULL,
  batch_name text NOT NULL,
  original_quantity integer NOT NULL CHECK (original_quantity > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0),
  purchase_price numeric NOT NULL DEFAULT 0 CHECK (purchase_price >= 0::numeric),
  selling_price numeric NOT NULL DEFAULT 0 CHECK (selling_price >= 0::numeric),
  marketing_price numeric DEFAULT NULL::numeric CHECK (marketing_price IS NULL OR marketing_price >= 0::numeric),
  supplier text,
  expiry_date date,
  batch_code text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  is_expired boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_batches_pkey PRIMARY KEY (id),
  CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.product_prices (
  id bigint NOT NULL DEFAULT nextval('product_prices_id_seq'::regclass),
  product_id bigint NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  type text NOT NULL CHECK (type IN ('selling', 'purchase', 'marketing')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamp with time zone DEFAULT now(),
  effective_to timestamp with time zone,
  notes text,
  quantity integer DEFAULT 0,
  CONSTRAINT product_prices_pkey PRIMARY KEY (id),
  CONSTRAINT product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.products (
  id bigint NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  name text NOT NULL CHECK (length(TRIM(BOTH FROM name)) > 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  barcode text,
  category text,
  description text,
  minimum_stock integer DEFAULT 10 CHECK (minimum_stock >= 0),
  purchase_price numeric DEFAULT 0 CHECK (purchase_price >= 0::numeric),
  selling_price numeric DEFAULT 0 CHECK (selling_price >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sale_items (
  id bigint NOT NULL DEFAULT nextval('sale_items_id_seq'::regclass),
  sale_id bigint NOT NULL,
  product_id bigint NOT NULL,
  product_name text NOT NULL,
  price_used numeric NOT NULL CHECK (price_used >= 0::numeric),
  quantity integer NOT NULL CHECK (quantity > 0),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  line_total numeric DEFAULT ((price_used * (quantity)::numeric) - discount_amount),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.sales (
  id bigint NOT NULL DEFAULT nextval('sales_id_seq'::regclass),
  customer_id bigint,
  customer_name text,
  total_price numeric NOT NULL CHECK (total_price >= 0::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  tax_amount numeric DEFAULT 0 CHECK (tax_amount >= 0::numeric),
  payment_method text DEFAULT 'نقدي'::text,
  notes text,
  invoice_number text,
  payment_type character varying DEFAULT 'نقدي'::character varying,
  is_credit boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE TABLE public.returns (
  id bigint NOT NULL DEFAULT nextval('returns_id_seq'::regclass),
  invoice_id bigint NOT NULL,
  return_number text NOT NULL,
  items jsonb NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales(id)
);

CREATE TABLE public.movements (
  id bigint NOT NULL DEFAULT nextval('movements_id_seq'::regclass),
  product_id bigint NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  ref_id bigint,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movements_pkey PRIMARY KEY (id),
  CONSTRAINT movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  username text UNIQUE,
  full_name text,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  preferences jsonb DEFAULT '{}'::jsonb,
  last_login timestamp with time zone,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- إنشاء sequences
CREATE SEQUENCE activity_log_id_seq;
CREATE SEQUENCE app_settings_id_seq;
CREATE SEQUENCE batch_sale_items_id_seq;
CREATE SEQUENCE categories_id_seq;
CREATE SEQUENCE credit_payments_id_seq;
CREATE SEQUENCE customer_credits_id_seq;
CREATE SEQUENCE customers_id_seq;
CREATE SEQUENCE product_batches_id_seq;
CREATE SEQUENCE product_prices_id_seq;
CREATE SEQUENCE products_id_seq;
CREATE SEQUENCE returns_id_seq;
CREATE SEQUENCE sale_items_id_seq;
CREATE SEQUENCE sales_id_seq;
CREATE SEQUENCE movements_id_seq;

-- إعداد RLS policies
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies للقراءة (متاح للجميع - يمكن تعديل حسب الحاجة)
CREATE POLICY "Enable read access for authenticated users" ON public.activity_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.app_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.batch_sale_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.credit_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.customer_credits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.product_batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.product_prices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.returns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.movements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.sale_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.sales FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.user_profiles FOR SELECT USING (auth.role() = 'authenticated');

-- RLS policies للكتابة (للمدراء والإداريين فقط)
CREATE POLICY "Enable write access for managers and admins" ON public.activity_log FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.app_settings FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.batch_sale_items FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.credit_payments FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.customer_credits FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.customers FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.product_batches FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.product_prices FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.products FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.returns FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.movements FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.sale_items FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.sales FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "Enable write access for managers and admins" ON public.user_profiles FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));

-- إدراج بيانات أولية
INSERT INTO public.app_settings (key, value, description) VALUES
('shop_name', '"مركز البدر"', 'اسم المتجر'),
('currency', '"د.ع"', 'العملة المستخدمة'),
('tax_rate', '0', 'نسبة الضريبة'),
('invoice_counter', '1', 'عداد الفواتير'),
('return_counter', '1', 'عداد المرتجعات');

-- إنشاء trigger للتحديث التلقائي لـ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_credits_updated_at BEFORE UPDATE ON public.customer_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON public.product_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_prices_updated_at BEFORE UPDATE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
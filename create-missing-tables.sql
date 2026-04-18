-- Create only the missing tables required by the app's current local schema and sync logic.
-- Run this on your Supabase/Postgres database.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.categories_id_seq;
CREATE TABLE IF NOT EXISTS public.categories (
  id bigint NOT NULL DEFAULT nextval('public.categories_id_seq'::regclass),
  name text NOT NULL CHECK (length(TRIM(BOTH FROM name)) > 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS public.returns_id_seq;
CREATE TABLE IF NOT EXISTS public.returns (
  id bigint NOT NULL DEFAULT nextval('public.returns_id_seq'::regclass),
  sale_id bigint NOT NULL,
  return_number text NOT NULL UNIQUE,
  invoice_number text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  reason text,
  status text NOT NULL DEFAULT 'returned',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);

CREATE SEQUENCE IF NOT EXISTS public.movements_id_seq;
CREATE TABLE IF NOT EXISTS public.movements (
  id bigint NOT NULL DEFAULT nextval('public.movements_id_seq'::regclass),
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

COMMIT;

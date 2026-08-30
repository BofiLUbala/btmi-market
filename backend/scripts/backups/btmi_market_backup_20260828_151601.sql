--
-- PostgreSQL database dump
--

\restrict p9qAJpePTva1e6v6kdZWLeqlgmFZiubbTckbgtdGjohIWqxM1I4vbyOs0Ok8OIt

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: account_type; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.account_type AS ENUM (
    'BUYER',
    'SELLER',
    'EMPLOYEE'
);


ALTER TYPE public.account_type OWNER TO btmi_user;

--
-- Name: assignment_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.assignment_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.assignment_status OWNER TO btmi_user;

--
-- Name: business_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.business_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);


ALTER TYPE public.business_status OWNER TO btmi_user;

--
-- Name: business_type; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.business_type AS ENUM (
    'RETAIL',
    'WHOLESALE',
    'MANUFACTURING',
    'SERVICES',
    'OTHER'
);


ALTER TYPE public.business_type OWNER TO btmi_user;

--
-- Name: cash_payment_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.cash_payment_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'REFUNDED'
);


ALTER TYPE public.cash_payment_status OWNER TO btmi_user;

--
-- Name: cash_reference_type; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.cash_reference_type AS ENUM (
    'SALE',
    'ORDER'
);


ALTER TYPE public.cash_reference_type OWNER TO btmi_user;

--
-- Name: cash_session_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.cash_session_status AS ENUM (
    'OPEN',
    'CLOSED',
    'RECONCILED'
);


ALTER TYPE public.cash_session_status OWNER TO btmi_user;

--
-- Name: customer_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.customer_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'BLOCKED'
);


ALTER TYPE public.customer_status OWNER TO btmi_user;

--
-- Name: employee_invitation_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.employee_invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'EXPIRED',
    'REVOKED'
);


ALTER TYPE public.employee_invitation_status OWNER TO btmi_user;

--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.employee_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'TERMINATED'
);


ALTER TYPE public.employee_status OWNER TO btmi_user;

--
-- Name: membership_role; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.membership_role AS ENUM (
    'OWNER',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE'
);


ALTER TYPE public.membership_role OWNER TO btmi_user;

--
-- Name: membership_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.membership_status AS ENUM (
    'ACTIVE',
    'PENDING',
    'SUSPENDED',
    'REMOVED'
);


ALTER TYPE public.membership_status OWNER TO btmi_user;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'PREPARING',
    'COMPLETED',
    'CANCELLED',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'RECEIVED',
    'READY_FOR_PICKUP',
    'HANDED_TO_PARTNER'
);


ALTER TYPE public.order_status OWNER TO btmi_user;

--
-- Name: product_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.product_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'DISCONTINUED'
);


ALTER TYPE public.product_status OWNER TO btmi_user;

--
-- Name: receipt_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.receipt_status AS ENUM (
    'PENDING',
    'RECEIVED',
    'CANCELLED'
);


ALTER TYPE public.receipt_status OWNER TO btmi_user;

--
-- Name: shop_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.shop_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE public.shop_status OWNER TO btmi_user;

--
-- Name: shop_type; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.shop_type AS ENUM (
    'PHYSICAL',
    'ONLINE'
);


ALTER TYPE public.shop_type OWNER TO btmi_user;

--
-- Name: stock_movement_type; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.stock_movement_type AS ENUM (
    'INITIAL',
    'STOCK_IN',
    'SALE_PHYSICAL',
    'SALE_ONLINE',
    'ADJUSTMENT',
    'RETURN',
    'TRANSFER_IN',
    'TRANSFER_OUT'
);


ALTER TYPE public.stock_movement_type OWNER TO btmi_user;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.user_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);


ALTER TYPE public.user_status OWNER TO btmi_user;

--
-- Name: variant_status; Type: TYPE; Schema: public; Owner: btmi_user
--

CREATE TYPE public.variant_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'DISCONTINUED'
);


ALTER TYPE public.variant_status OWNER TO btmi_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_activation_tokens; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.account_activation_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


ALTER TABLE public.account_activation_tokens OWNER TO btmi_user;

--
-- Name: business_memberships; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.business_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    business_id uuid NOT NULL,
    role public.membership_role DEFAULT 'EMPLOYEE'::public.membership_role NOT NULL,
    status public.membership_status DEFAULT 'ACTIVE'::public.membership_status,
    joined_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.business_memberships OWNER TO btmi_user;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.businesses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    business_type public.business_type DEFAULT 'RETAIL'::public.business_type NOT NULL,
    category character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    whatsapp character varying(20) DEFAULT ''::character varying,
    email character varying(255) NOT NULL,
    country character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    default_currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    status public.business_status DEFAULT 'ACTIVE'::public.business_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.businesses OWNER TO btmi_user;

--
-- Name: buyer_levels; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.buyer_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    min_points integer NOT NULL,
    max_points integer NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    delivery_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    free_delivery boolean DEFAULT false NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.buyer_levels OWNER TO btmi_user;

--
-- Name: buyer_payments; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.buyer_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    buyer_profile_id uuid NOT NULL,
    payment_method character varying(20) DEFAULT 'CASH'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'CDF'::character varying NOT NULL,
    products_base_total numeric(15,2) DEFAULT 0 NOT NULL,
    products_points_used integer DEFAULT 0 NOT NULL,
    products_points_discount numeric(15,2) DEFAULT 0 NOT NULL,
    products_final_total numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_fee_base numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_points_used integer DEFAULT 0 NOT NULL,
    delivery_points_discount numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_fee_final numeric(15,2) DEFAULT 0 NOT NULL,
    cash_due numeric(15,2) DEFAULT 0 NOT NULL,
    buyer_confirmed boolean DEFAULT false NOT NULL,
    buyer_confirmed_at timestamp with time zone,
    seller_confirmed boolean DEFAULT false NOT NULL,
    seller_confirmed_by uuid,
    seller_confirmed_at timestamp with time zone,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.buyer_payments OWNER TO btmi_user;

--
-- Name: buyer_profiles; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.buyer_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    city character varying(255) DEFAULT ''::character varying,
    commune character varying(255) DEFAULT ''::character varying,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    backup_phone character varying(50) DEFAULT ''::character varying NOT NULL,
    address character varying(500) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.buyer_profiles OWNER TO btmi_user;

--
-- Name: cash_payments; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.cash_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    employee_id uuid,
    customer_id uuid,
    cash_session_id uuid,
    reference_type public.cash_reference_type NOT NULL,
    reference_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    status public.cash_payment_status DEFAULT 'CONFIRMED'::public.cash_payment_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cash_payments OWNER TO btmi_user;

--
-- Name: cash_sessions; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    employee_id uuid,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    opening_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    cash_sales_total numeric(12,2) DEFAULT 0 NOT NULL,
    expected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    declared_closing_amount numeric(12,2),
    difference numeric(12,2),
    reconciliation_result character varying(20),
    status public.cash_session_status DEFAULT 'OPEN'::public.cash_session_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cash_sessions OWNER TO btmi_user;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.categories OWNER TO btmi_user;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    first_name character varying(100) DEFAULT ''::character varying NOT NULL,
    last_name character varying(100) DEFAULT ''::character varying NOT NULL,
    phone character varying(50),
    email character varying(255),
    status public.customer_status DEFAULT 'ACTIVE'::public.customer_status NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.customers OWNER TO btmi_user;

--
-- Name: employee_activation_tokens; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.employee_activation_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_activation_tokens OWNER TO btmi_user;

--
-- Name: employee_invitations; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.employee_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    status public.employee_invitation_status DEFAULT 'PENDING'::public.employee_invitation_status,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_invitations OWNER TO btmi_user;

--
-- Name: employee_shop_assignments; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.employee_shop_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    status public.assignment_status DEFAULT 'ACTIVE'::public.assignment_status,
    assigned_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_shop_assignments OWNER TO btmi_user;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    linked_user_id uuid,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100) DEFAULT ''::character varying,
    last_name character varying(100) NOT NULL,
    phone character varying(20) DEFAULT ''::character varying,
    email character varying(255) DEFAULT ''::character varying,
    job_title character varying(100) DEFAULT ''::character varying,
    status public.employee_status DEFAULT 'ACTIVE'::public.employee_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO btmi_user;

--
-- Name: inventory; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.inventory (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    variant_id uuid NOT NULL,
    CONSTRAINT positive_quantity CHECK ((quantity >= 0)),
    CONSTRAINT positive_reserved CHECK ((reserved_quantity >= 0))
);


ALTER TABLE public.inventory OWNER TO btmi_user;

--
-- Name: level_benefits; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.level_benefits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level_type character varying(20) NOT NULL,
    level_name character varying(50) NOT NULL,
    benefit_type character varying(100) NOT NULL,
    benefit_value numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.level_benefits OWNER TO btmi_user;

--
-- Name: order_lines; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.order_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    base_unit_price numeric(15,2) DEFAULT 0,
    points_discount_per_unit numeric(15,2) DEFAULT 0,
    final_unit_price numeric(15,2) DEFAULT 0,
    CONSTRAINT order_lines_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_lines OWNER TO btmi_user;

--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: btmi_user
--

CREATE SEQUENCE public.order_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_number_seq OWNER TO btmi_user;

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    status public.order_status NOT NULL,
    changed_by uuid,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.order_status_history OWNER TO btmi_user;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    status public.order_status DEFAULT 'PENDING'::public.order_status,
    total_items integer DEFAULT 0,
    notes text DEFAULT ''::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_id uuid,
    buyer_profile_id uuid,
    base_total numeric(15,2) DEFAULT 0,
    points_used integer DEFAULT 0,
    points_discount_amount numeric(15,2) DEFAULT 0,
    final_total numeric(15,2) DEFAULT 0,
    idempotency_key character varying(255),
    delivery_method character varying(20) DEFAULT ''::character varying NOT NULL,
    delivery_fee_base numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_points_used integer DEFAULT 0 NOT NULL,
    delivery_points_discount numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_fee_final numeric(15,2) DEFAULT 0 NOT NULL,
    delivery_contact_name character varying(255) DEFAULT ''::character varying NOT NULL,
    delivery_phone character varying(50) DEFAULT ''::character varying NOT NULL,
    delivery_address character varying(500) DEFAULT ''::character varying NOT NULL,
    delivery_notes text DEFAULT ''::text NOT NULL,
    points_finalized boolean DEFAULT false NOT NULL,
    order_number character varying(20),
    accepted_at timestamp with time zone,
    preparing_at timestamp with time zone,
    ready_at timestamp with time zone,
    out_for_delivery_at timestamp with time zone,
    delivered_at timestamp with time zone,
    received_at timestamp with time zone,
    completed_at timestamp with time zone,
    inventory_claimed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.orders OWNER TO btmi_user;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO btmi_user;

--
-- Name: point_accounts; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.point_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_type character varying(20) NOT NULL,
    owner_id uuid NOT NULL,
    current_points integer DEFAULT 0 NOT NULL,
    lifetime_points integer DEFAULT 0 NOT NULL,
    level_id uuid,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    reserved_points integer DEFAULT 0
);


ALTER TABLE public.point_accounts OWNER TO btmi_user;

--
-- Name: point_config; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.point_config (
    key character varying(100) NOT NULL,
    value numeric(15,4) NOT NULL,
    description text DEFAULT ''::text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.point_config OWNER TO btmi_user;

--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    point_account_id uuid NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    points_change integer NOT NULL,
    previous_points integer NOT NULL,
    new_points integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.point_transactions OWNER TO btmi_user;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.product_images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    file_name character varying(255) DEFAULT ''::character varying,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid
);


ALTER TABLE public.product_images OWNER TO btmi_user;

--
-- Name: product_review_aggregates; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.product_review_aggregates (
    product_id uuid NOT NULL,
    average_rating numeric(3,2) DEFAULT 0.00 NOT NULL,
    total_reviews integer DEFAULT 0 NOT NULL,
    rating_1_count integer DEFAULT 0 NOT NULL,
    rating_2_count integer DEFAULT 0 NOT NULL,
    rating_3_count integer DEFAULT 0 NOT NULL,
    rating_4_count integer DEFAULT 0 NOT NULL,
    rating_5_count integer DEFAULT 0 NOT NULL,
    last_review_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_review_aggregates OWNER TO btmi_user;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    sku character varying(100) DEFAULT ''::character varying,
    name character varying(255) DEFAULT ''::character varying,
    attributes jsonb DEFAULT '{}'::jsonb,
    sale_price numeric(15,2) DEFAULT 0,
    purchase_price numeric(15,2) DEFAULT 0,
    barcode character varying(100) DEFAULT ''::character varying,
    unit character varying(50) DEFAULT 'PCS'::character varying,
    status public.variant_status DEFAULT 'ACTIVE'::public.variant_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_variants OWNER TO btmi_user;

--
-- Name: products; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100) DEFAULT ''::character varying,
    description text DEFAULT ''::text,
    unit_price numeric(15,2) DEFAULT 0,
    cost_price numeric(15,2) DEFAULT 0,
    unit character varying(50) DEFAULT 'PCS'::character varying,
    status public.product_status DEFAULT 'ACTIVE'::public.product_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    publication_status character varying(20) DEFAULT 'PUBLISHED'::character varying,
    category_id uuid,
    subcategory_id uuid,
    discount_active boolean DEFAULT false NOT NULL,
    discount_type character varying(20) DEFAULT 'NONE'::character varying NOT NULL,
    discount_value numeric(15,2) DEFAULT 0.00 NOT NULL,
    discount_start timestamp with time zone,
    discount_end timestamp with time zone
);


ALTER TABLE public.products OWNER TO btmi_user;

--
-- Name: purchase_confirmations; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.purchase_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    buyer_profile_id uuid NOT NULL,
    cash_payment_id uuid,
    confirmed_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_confirmations OWNER TO btmi_user;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    user_agent character varying(500) DEFAULT ''::character varying,
    ip_address character varying(45) DEFAULT ''::character varying,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


ALTER TABLE public.refresh_tokens OWNER TO btmi_user;

--
-- Name: review_helpful_votes; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.review_helpful_votes (
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.review_helpful_votes OWNER TO btmi_user;

--
-- Name: review_history; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.review_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    old_rating smallint NOT NULL,
    new_rating smallint NOT NULL,
    old_comment text DEFAULT ''::text,
    new_comment text DEFAULT ''::text,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.review_history OWNER TO btmi_user;

--
-- Name: review_replies; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.review_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_replies_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))
);


ALTER TABLE public.review_replies OWNER TO btmi_user;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schema_migrations OWNER TO btmi_user;

--
-- Name: seller_levels; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.seller_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    min_points integer NOT NULL,
    max_points integer NOT NULL,
    search_boost numeric(5,2) DEFAULT 0 NOT NULL,
    recommendation_eligible boolean DEFAULT false NOT NULL,
    high_value_buyer_access boolean DEFAULT false NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_levels OWNER TO btmi_user;

--
-- Name: seller_reviews; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.seller_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    buyer_profile_id uuid NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text DEFAULT ''::text,
    verified_purchase boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_id uuid,
    order_line_id uuid,
    variant_id uuid,
    delivery_rating smallint,
    service_rating smallint,
    order_experience_rating smallint,
    CONSTRAINT seller_reviews_delivery_rating_check CHECK (((delivery_rating >= 1) AND (delivery_rating <= 5))),
    CONSTRAINT seller_reviews_order_experience_rating_check CHECK (((order_experience_rating >= 1) AND (order_experience_rating <= 5))),
    CONSTRAINT seller_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT seller_reviews_service_rating_check CHECK (((service_rating >= 1) AND (service_rating <= 5)))
);


ALTER TABLE public.seller_reviews OWNER TO btmi_user;

--
-- Name: seller_trust; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.seller_trust (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    trust_status character varying(20) DEFAULT 'NORMAL'::character varying NOT NULL,
    verified_sales_count integer DEFAULT 0 NOT NULL,
    order_completion_rate numeric(5,2) DEFAULT 100.00 NOT NULL,
    cancellation_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    purchase_confirmation_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    stock_reliability_rate numeric(5,2) DEFAULT 100.00 NOT NULL,
    last_calculated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_trust OWNER TO btmi_user;

--
-- Name: shop_review_aggregates; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.shop_review_aggregates (
    shop_id uuid NOT NULL,
    average_rating numeric(3,2) DEFAULT 0.00 NOT NULL,
    total_reviews integer DEFAULT 0 NOT NULL,
    rating_1_count integer DEFAULT 0 NOT NULL,
    rating_2_count integer DEFAULT 0 NOT NULL,
    rating_3_count integer DEFAULT 0 NOT NULL,
    rating_4_count integer DEFAULT 0 NOT NULL,
    rating_5_count integer DEFAULT 0 NOT NULL,
    last_review_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shop_review_aggregates OWNER TO btmi_user;

--
-- Name: shops; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.shops (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type public.shop_type DEFAULT 'PHYSICAL'::public.shop_type NOT NULL,
    city character varying(100) DEFAULT ''::character varying,
    address character varying(500) DEFAULT ''::character varying,
    phone character varying(20) DEFAULT ''::character varying,
    status public.shop_status DEFAULT 'ACTIVE'::public.shop_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    supports_shop_delivery boolean DEFAULT false,
    shop_delivery_fee numeric(15,2) DEFAULT 0,
    supports_partner_delivery boolean DEFAULT false,
    partner_delivery_fee numeric(15,2) DEFAULT 0,
    partner_delivery_provider character varying(100) DEFAULT ''::character varying,
    delivery_city character varying(255) DEFAULT ''::character varying,
    delivery_address character varying(255) DEFAULT ''::character varying
);


ALTER TABLE public.shops OWNER TO btmi_user;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    product_id uuid NOT NULL,
    movement_type public.stock_movement_type NOT NULL,
    quantity integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    reference_id uuid,
    notes text DEFAULT ''::text,
    performed_by uuid,
    employee_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid
);


ALTER TABLE public.stock_movements OWNER TO btmi_user;

--
-- Name: stock_receipt_lines; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.stock_receipt_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    receipt_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(15,2) DEFAULT 0,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stock_receipt_lines_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.stock_receipt_lines OWNER TO btmi_user;

--
-- Name: stock_receipts; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.stock_receipts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    received_by uuid,
    reference_number character varying(100) DEFAULT ''::character varying,
    notes text DEFAULT ''::text,
    status public.receipt_status DEFAULT 'PENDING'::public.receipt_status,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_receipts OWNER TO btmi_user;

--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.subcategories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subcategories OWNER TO btmi_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100) DEFAULT ''::character varying,
    last_name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status public.user_status DEFAULT 'PENDING_VERIFICATION'::public.user_status,
    email_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    account_type public.account_type DEFAULT 'BUYER'::public.account_type NOT NULL
);


ALTER TABLE public.users OWNER TO btmi_user;

--
-- Name: verified_transactions; Type: TABLE; Schema: public; Owner: btmi_user
--

CREATE TABLE public.verified_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    business_id uuid NOT NULL,
    buyer_profile_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(10) DEFAULT 'CDF'::character varying NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    verified_at timestamp without time zone,
    refunded_at timestamp without time zone,
    points_awarded_seller boolean DEFAULT false NOT NULL,
    points_awarded_buyer boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.verified_transactions OWNER TO btmi_user;

--
-- Data for Name: account_activation_tokens; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.account_activation_tokens (id, user_id, token_hash, created_at, expires_at, used_at) FROM stdin;
c7770040-5751-497e-89c8-7a19d1f9927f	2b453813-5644-4fde-b134-d2bc067987a9	e8ab8168bde967a10311b528c6600536ca8b0ae509d7678f4374e73e0df40e4a	2026-08-21 03:04:00.214842+00	2026-08-22 03:04:00.214823+00	2026-08-21 03:04:37.953799+00
22306832-fe5b-4f47-8366-8a6b7df689db	4ad3d1d8-8224-48e3-a15f-efd114544a97	f99e81adac00f6b54632dee1dcef052958a2bb4a0082fdf0627ed44306657a11	2026-08-21 03:53:38.854319+00	2026-08-22 03:53:38.854226+00	2026-08-21 03:53:41.044667+00
e1060af9-a5e2-4f04-beef-5adbbf745077	6ef27787-11f2-4de0-960f-c5d9308d0e28	7697bd54147ab6e10b6172f1fac38433aed0e30807fde5e2feb18e7586bc21b8	2026-08-21 03:53:53.755841+00	2026-08-22 03:53:53.75584+00	2026-08-21 03:53:54.165351+00
f6a77dac-c353-4da3-9b66-72cc18d70206	9fbf0cc2-ae16-45fb-a3e0-7fc1db4b4bc7	47876ed992ac00e9b7da4c3502e32d29340650878ce85aa326ed746e8980e468	2026-08-21 03:53:54.65725+00	2026-08-22 03:53:54.657249+00	2026-08-21 03:53:55.123295+00
75091e1e-8b26-4494-9c9f-8b45cda3b745	00c2d92b-4a5a-4000-b15b-a888d217f4c9	65634f64695daf444f5661412ce0d5f7fdc27cb99acd83c96633ed3d5f47f6c9	2026-08-21 04:15:57.206507+00	2026-08-22 04:15:57.206465+00	2026-08-21 04:15:59.91809+00
c546b931-7597-446d-8bd7-cf6ca4636f93	a64886eb-19bc-49fd-9fc6-d2090eec44ed	5e9a47809cbd4f15205a68de45ccb832d4e7c5cea4237111fa5912394e3bd74f	2026-08-21 04:16:12.798949+00	2026-08-22 04:16:12.798947+00	2026-08-21 04:16:13.059618+00
a2dafca4-1088-4b52-9446-388f65ae4f9c	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	017da8518274040c6c9a6efb36803ac874013bd219e7fa4039028573df94bf3c	2026-08-21 04:16:13.440342+00	2026-08-22 04:16:13.44034+00	2026-08-21 04:16:13.816223+00
17d4ca2a-e311-4e67-beef-fa4855977cfe	96bee62f-1d2c-4714-86d4-20f96a6cc661	d51b5dffaeb681d0d41946e7e68c33689ea7a95265b30dd31bd9766ccd07d1c8	2026-08-21 04:27:42.703551+00	2026-08-22 04:27:42.703544+00	2026-08-21 04:27:44.012086+00
81692178-c023-45f2-8477-bb0856c82ab6	9fefe244-252b-43b2-a452-d6621b6a0546	4095c799bb6fba2e62d722dd0341c20973e60069ae15331ebf480286d37c3134	2026-08-21 09:45:20.069986+00	2026-08-22 09:45:20.069641+00	\N
5570d63f-32e1-40fd-b112-d9dea7d2b191	dfd1d4a5-c175-4348-9601-8a4d27802d63	2bc4a7c1ca6a930a82fb95f4f4612a0c5f0a6bcaab89b04e25af539ec1a82602	2026-08-21 10:17:32.139059+00	2026-08-22 10:17:32.139043+00	\N
391972ae-13f0-4e59-934a-f5f99f53b137	42861d49-0faa-4c2f-9af0-c2705d5ac72f	3075365ebadda3f7f2592aaf55cf3f89bf35e4fcde565def2b3ec226e6e2b25b	2026-08-21 10:17:49.411653+00	2026-08-22 10:17:49.411653+00	\N
b26405e0-f27d-4c3e-a35b-605877a14a25	ca16f4d1-e5f7-418a-8aed-426facadd4ef	14990a08d92a9cb3bc1dbfb262fb5146f1d01b014527d77d400b40039c9ef287	2026-08-21 10:17:54.660145+00	2026-08-22 10:17:54.660144+00	\N
90c5db64-3808-4ab6-bb20-1976c4ea010e	10f488ae-e546-407e-ad82-96efb18466c6	081b5a5b1ff53e7470822cd1f9bfee7a455ac8ef81c98205f628ade8e871f26b	2026-08-21 10:35:18.048402+00	2026-08-22 10:35:18.048394+00	2026-08-21 10:36:22.253876+00
bf30f80f-b710-45f9-aef0-4140cb0dad75	d6c335ec-c9ab-412e-b8b8-ccaa707d6459	e4a706fa3105d720348d9e9c0e65b9f1adb779367aa83b1dff83c5a74cc88ce0	2026-08-21 11:21:56.23502+00	2026-08-22 11:21:56.235008+00	\N
a5d10d8e-1fe6-466b-a8e8-183cf20aeaa4	f827bb2d-a0de-44d5-bc8b-2420eb649399	67f9c7d3b6a3e056e71164b3aae51a09303b1bc7d478cd30bcf40245367c5940	2026-08-21 11:22:01.863069+00	2026-08-22 11:22:01.863068+00	\N
41df2c04-da65-41c6-ae1b-931d544776d3	161b2af3-20d7-48f9-8a93-f1955402178c	99e303443cb606a793a2547e567865ff8949fcf31f06c26a1bb8f9a432f10a97	2026-08-21 11:22:37.869731+00	2026-08-22 11:22:37.86973+00	\N
18dcfef4-9c8f-49a3-9b27-e044069cf0f0	1b928f7c-b6a7-4068-a392-d4f3f51fc93b	62e65f094a56590b80e1826b7049e76a7212e81098e36bb2bcb3f406b651c1d6	2026-08-21 11:23:32.877385+00	2026-08-22 11:23:32.877383+00	\N
9dcec267-aa16-4219-a07f-f7ea53a6e39f	76d852b2-31fd-42a0-a775-499b1e547358	5d916e6c39921300d53bb61602ad84a16fead229177557a799d1a411cce5b087	2026-08-21 11:24:29.762078+00	2026-08-22 11:24:29.762076+00	\N
6e0c6885-35da-49af-9684-4ac3e75ebc25	88810add-fec9-4976-88bb-733ba17081c9	a8905f1a604ad1a1c047618d114a29dbd9972bfc3fe553bcf72e17a1f14045e3	2026-08-21 11:33:18.810442+00	2026-08-22 11:33:18.810414+00	\N
2fc64045-d83b-4501-bc99-b518b49836f5	0dd0cece-b905-49f5-a3e5-15a72cc42d19	cd77701ea2c145c409179549cbe1f1d7818d0df9c404dd63ce5b9ab45a1ae6e4	2026-08-21 11:33:24.127811+00	2026-08-22 11:33:24.127809+00	\N
3d1971b3-0538-4946-8efb-a05b07ef24df	a0de438d-d002-40e3-bbf8-4f6db93d2806	b12a012a70ececc0ea9f5ca847c0e704e482eba412241f14dc1291e283fb0f20	2026-08-21 11:51:22.763715+00	2026-08-22 11:51:22.76362+00	\N
3519cdd2-c1ac-4ef9-8fc3-8f6b799a44a5	deff6045-e0b5-4005-8333-9c22e88edc61	a3278688edd154e3b82eddc2accab489cdc0d583ddd4ab38b2d61fcfa8d7fb5c	2026-08-21 11:53:42.330986+00	2026-08-22 11:53:42.330982+00	\N
be0a2b92-8be4-47da-831d-e1ceb9ced50a	e271741f-799d-49b0-ac63-8e382d67fc6c	4676f18355b26a9158dbc925d3f7600bdff3bb6e1b43cd6f5f98368142008c9b	2026-08-21 11:54:24.338512+00	2026-08-22 11:54:24.338511+00	\N
4b0bff4c-7c17-4884-90a6-45a36bd816de	54721785-d2ea-42a3-9b02-c89c13f72777	44ee0c47015f5d0fb644c8e525cda9b2e986b8a321ff0863807e769dc2e1a519	2026-08-21 11:54:28.763327+00	2026-08-22 11:54:28.763314+00	\N
ac9dd21e-91d9-48b2-bda9-477f4a6102f3	dec18fe0-92d5-4faf-98db-9c5d615fdace	11e7e5b2d5809655a372a13d2f87539ec37b6463fbd749195e7b78ff0060aafb	2026-08-21 14:02:46.853479+00	2026-08-22 14:02:46.853472+00	\N
cc15a413-27c0-4e0f-9701-23d93f4347a1	fe4af24e-8a53-4d72-a56c-5bb51b5937bc	a7c910cdaf5fd3fc070a33aac8dd7812db473d91208234076dffb0d59f413d17	2026-08-21 14:02:57.791471+00	2026-08-22 14:02:57.79147+00	\N
96b482b2-ac19-4a5b-b450-f11ffd3ba67d	dae3304d-d7b9-46e0-adb4-0f7b023a9500	b90cb2cb36b0a799d07b06ab7b1fd5d3972bf29e81627f382e317add0ddcd37c	2026-08-21 14:09:13.91991+00	2026-08-22 14:09:13.919909+00	\N
8b1451e1-36d8-4b2b-a77e-4860757479a3	2f7f19dc-5d38-4642-a3d8-4c1ed2e11d8c	6cec1fa0a16aae0026f89d0bdcc19dfaed03a3be6d940001c106ed58923ceead	2026-08-21 14:09:19.880828+00	2026-08-22 14:09:19.880827+00	\N
78b4653d-4ec2-41fc-ba68-53608a292e9b	c18774e1-d8f5-40f5-8582-f2b9b55912e7	19430086c6bdcc6d6f3d35bf013f0c4c654dd03829590af3170f3040671b7ad4	2026-08-21 14:10:22.900455+00	2026-08-22 14:10:22.900454+00	\N
0160c43d-d6e7-4b44-ad3c-9f6d0e17646a	ad91281f-138a-411c-ada1-8d11f4625237	3dd1d4e347c21a91fe50e0ae834feed77ef7eb1efd19d303e10787f59b9432bb	2026-08-21 14:10:27.984819+00	2026-08-22 14:10:27.984818+00	\N
6ef8064e-a506-421d-b07f-f1f5ebdf1ef7	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	11526c85b64842126f104dd444ef951aa5f479ebaf182808c184738c5618fc0e	2026-08-21 14:12:59.509766+00	2026-08-22 14:12:59.509765+00	\N
bd97c95f-9649-4931-aa5d-5b46f8bfcddc	79684130-93c3-44c7-a9c9-b3c313449da5	fed833554daf723237dc24f42d9da27f655f41930764216546102389afbff214	2026-08-21 14:13:07.245521+00	2026-08-22 14:13:07.245521+00	\N
8af5c12a-a0d7-4d71-8bf8-ab610451bc67	d31867cb-cc3e-49c6-ba4c-04d10901255b	d96877d875fe801cb153c2b01f1d4ae75d782e29e426a5f766aba1ff482dad60	2026-08-21 14:13:48.907482+00	2026-08-22 14:13:48.907482+00	\N
96a53a1b-4d74-4779-b36f-1cbc6add9954	fea3d9d4-bb12-4a43-8d31-347af8c4e20d	088f570deb7d8cd4ee40b34aa03e2a5cd94e679967180ae1a3c22c83a5d58c5f	2026-08-21 14:13:54.759063+00	2026-08-22 14:13:54.759063+00	\N
01eba267-3f10-4e96-9bce-3eb89c3b4ce0	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	9ee27f17e683aac70a2f8e294664d2b0d8f5ed9704f7ab7cae9875d7ba436ffa	2026-08-21 14:27:42.589609+00	2026-08-22 14:27:42.589599+00	\N
1c26ac06-fa60-4de0-9b0a-ec73c23cad95	2eeaca0b-ca2c-4c5d-8a40-7781627b2bf2	6c172a980d6df60ba514cc101b4f7859e72829506e9a27fea686c77affb8a9d1	2026-08-21 14:27:48.599723+00	2026-08-22 14:27:48.599722+00	\N
028d717c-c719-4c5e-af6c-4ba8ac442c7f	53eabe9b-cf41-4444-a608-b08e85779c01	c06115881790c84a20317896ada477daae89f04c444e73ff077f82bee0614640	2026-08-21 14:28:45.955599+00	2026-08-22 14:28:45.955597+00	\N
cc085f3d-e284-4aba-bc74-74e45af1fb30	8dce0e1e-2356-4798-be5d-0c2224a69939	34f1f691b0bb70868f3e710c400919b9ac12cfd0ff8e7087562bf96e4339f51f	2026-08-21 14:28:52.69493+00	2026-08-22 14:28:52.694929+00	\N
ef6568bc-2db5-4b9a-a7f2-18779086f466	e4b19e15-2db5-4c16-82a8-5961cbe69a10	7256e1a6e7583686fb08760d4e5b25c8d8ef6f95914864de643006a890b9f088	2026-08-21 22:45:23.202411+00	2026-08-22 22:45:23.199314+00	\N
028920db-ba7f-435f-8c97-9017bc5aee3f	278ad0a5-5139-4fd6-86b0-45014f28d6a7	76e299c87ddc4bb0c321e94da35879a5335590c735a9d9a4a856a5aa6387ac2e	2026-08-21 22:46:31.721116+00	2026-08-22 22:46:31.721115+00	\N
9e2dc781-93b6-48e4-a001-e21087a4e585	88405f91-3489-4d58-b613-296bef30e2ef	2e9ffe5ada8329af6bcdf4001dcd4c014516f4b4f497106bee1a2b1b2973600c	2026-08-21 22:47:34.789981+00	2026-08-22 22:47:34.78998+00	\N
399bf419-8c6e-4e2a-8111-db774ffcce91	6912915d-4dd3-41dd-9c46-6a0efc2afa46	ad7cd86ed2766f60233b556bd623204238ddf1ab2b9f0b6fc36e4f3b3b8b5ed6	2026-08-21 22:59:55.13959+00	2026-08-22 22:59:55.139559+00	\N
2089750e-9441-4199-b7df-d8470445c80f	4afcb35b-ebb0-492c-bc26-f4961e0c43da	a0808dc9154e056614f4e5591d192b06215531efe700f7ddac77880a43080df4	2026-08-21 23:02:14.001583+00	2026-08-22 23:02:14.001581+00	\N
fd9616e8-5733-45be-8e17-58683e189636	6b7cadef-8ebe-4d0d-b219-39e7614245ff	63b9442244c2b745b7eda6fb9f9861c58381cb58e7fa6dbbcebb1d3dbd7e8208	2026-08-21 23:06:17.190803+00	2026-08-22 23:06:17.190784+00	\N
fbcf4a23-c2f7-4fe9-8ff8-c19579d96c99	3b604540-0c86-43ad-a66b-15431c4664f5	cd4d1d6197ff15e1087b25c933a5586b395d7e555d5294e46251d2c4237688b3	2026-08-21 23:08:26.523345+00	2026-08-22 23:08:26.523328+00	\N
ed4004a9-a90c-444d-9e96-e53902ed60b7	33ee2282-5467-4c59-ac70-b4b6a020f38f	627c43290713a557c0f304cef20a1df6c8af207a54748bbde5040687bdf5ad2a	2026-08-22 00:15:35.748513+00	2026-08-23 00:15:35.748493+00	\N
93d4adb3-ec12-414c-bdf8-51a8bb8bbf67	ba65bf54-08eb-4e24-92b3-2e15df894059	27e71ea27588e8ffc0691b535bc6a361426be232f18e662ccb1e4f3f0a18f2e0	2026-08-22 01:06:30.89995+00	2026-08-23 01:06:30.899949+00	\N
7a359e94-4f7a-4e42-8b85-a44d961bfb08	917cf438-53bd-4522-965d-71a60c34b814	5ec4bd9e91e60d5a0bd6303183e7f29cd4cc7a260dd2c12bcf00623522b9ed57	2026-08-22 01:07:11.049461+00	2026-08-23 01:07:11.04946+00	\N
522b4e69-0b1b-4f08-be61-a595db624860	ae2e7050-4bc6-407b-b670-98d82a215b9b	e568030294c0f2679c6f90d3bf4885c942df006126f40d0e29cd5528858118be	2026-08-24 14:58:58.133196+00	2026-08-25 14:58:58.133194+00	2026-08-24 14:59:23.795138+00
7df88d00-0f06-4e1f-a20d-57980828d967	d192ad05-0c89-4e1c-bf1b-3216ef75e2a0	086d91b85e67827a5f8e6f14296b0301d3350012901864312891ff079af07be1	2026-08-25 07:59:04.953339+00	2026-08-26 07:59:04.953337+00	\N
f53fcddc-dc5e-48c5-9413-412df4f576b4	61cf8876-bd88-4ba4-9257-573fe6d9ca3d	dd9c173fe74eab711deda52940e86e76368db06ccc71c8ab617d90f25ec8217d	2026-08-25 07:59:22.584631+00	2026-08-26 07:59:22.584626+00	\N
9f37e1f3-a319-406d-844f-af9012713c0f	8df33969-22f4-41ee-ada8-af1843e7d3e7	ae8d9ec173101147c52cb727ddf2878b68588716ad99c9122e7432815c34cd65	2026-08-25 07:59:26.357911+00	2026-08-26 07:59:26.35791+00	\N
53dc7982-c57a-4ad8-92df-d5df48649b14	cc99b54c-7686-4a74-9316-4da128b544d7	5b94b8ef00cf8397aa38304a028998ed1957afea99957fc802e13f05d4f49b7b	2026-08-25 08:24:47.823409+00	2026-08-26 08:24:47.823407+00	\N
f7063811-abd9-4e15-aef1-b805fe723085	07f2e0b3-6709-4cf0-afcc-6b24db94ce93	eff4e54ccd3ca7456683f5da404b7087dc4eae7fdb9b70341c8ffd9901f4362a	2026-08-26 13:17:18.529767+00	2026-08-27 13:17:18.529766+00	\N
baa2abd6-9c65-4f60-a78e-b6dc246928b0	54998434-5ff1-413a-91fd-c928cfbae493	5ebf02dfd113274ffa2aa9d11bcac5b3c051716812b4d27d9e1c5639fde28e29	2026-08-26 13:17:25.069095+00	2026-08-27 13:17:25.069093+00	\N
0e1d86a6-e735-44e4-9bf5-cdc7c84beca4	2f4bb545-2f88-4326-a274-e12b0815656e	c366f4ba2455be488848cd929713c42cb2625ad045d9f3e9fb212f93fb1b04b8	2026-08-26 13:18:56.947506+00	2026-08-27 13:18:56.947504+00	\N
b9b5308e-7f00-423c-bb1e-f0f962331e5f	d440befb-c451-4c38-95f1-ba5c057ca0d9	3d9e376912af9d46d3850e4d6b4038f7416b7046b396b8236f0b1eaac9eb8959	2026-08-26 13:19:02.328492+00	2026-08-27 13:19:02.32849+00	\N
f296e4f5-15d8-48d4-bf8c-70c1f5ab3579	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	7940d3c1e429b1e2a134c5508d1de12836f871b452be4df0958c778035e3ba10	2026-08-26 13:26:29.835962+00	2026-08-27 13:26:29.835961+00	\N
851e990d-7895-4012-ac8e-be173f864454	5593d59e-3cc5-4da3-955d-80f2cbbca1fd	02ac0424ec8b67c7fe4db3ff1159a0ce7776368aa6dc2abcdc5aba237527fb36	2026-08-26 13:26:35.817049+00	2026-08-27 13:26:35.817047+00	\N
319332d3-421e-4bd1-9aca-1648a5697324	df9edc86-2eac-40d6-a0b4-625385b387bc	cf94cf1faf52c039124ceeef0cb62d4e4905cd5095b38f6cf93b2550d79c3733	2026-08-26 13:28:02.360922+00	2026-08-27 13:28:02.360921+00	\N
a445515d-25a1-4747-85b0-e70ccda998af	5384da9a-5b5b-4df0-9063-7cbb8cd163ff	41daf400846796a51740326baf2f3750d00757e73d0d925f3271d47f1b71e140	2026-08-26 13:28:08.147825+00	2026-08-27 13:28:08.147824+00	\N
1aba63d5-e11f-466f-810a-0faffbc0e79c	f87c1ce5-6819-4d12-a0a9-85055d806ae5	ed6dcdd68b6d085193665784d0729fc5ecf93c890de98eb033baf67d9be0bd25	2026-08-26 15:20:02.552503+00	2026-08-27 15:20:02.55219+00	\N
80d9d362-2b57-463a-9e93-e39eb2a8e902	f56c4268-e4d2-4382-8e8a-8ba603e663f7	4fd6348263dd56708c4770c97ef76ee319a8f97f9b26d36a1bcbeb3133ea6f52	2026-08-26 15:21:19.308691+00	2026-08-27 15:21:19.30869+00	\N
27530ed4-ea7e-4106-a78c-8fc90fe19d3a	8700aec8-b351-4e33-845e-8254918e00ad	2ab0e97d0413da457eee1ae8fe6f5936369f3781ebb748d796ea937ef54662bf	2026-08-26 15:53:53.105618+00	2026-08-27 15:53:53.105588+00	\N
a3cd6af5-9809-4e81-85bf-952b548ea81d	1bb14759-9967-4d6c-8a65-91e91731f726	f8b6a1fd14d78844231c5b2612b45328e10e55858605ef9c414633e30320342a	2026-08-26 18:33:04.344048+00	2026-08-27 18:33:04.343753+00	\N
\.


--
-- Data for Name: business_memberships; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.business_memberships (id, user_id, business_id, role, status, joined_at, created_at, updated_at) FROM stdin;
1210c0d0-168c-4a83-92d1-1c3bff21b61d	4ad3d1d8-8224-48e3-a15f-efd114544a97	91eb7ec0-476f-41f3-9845-af89f864f129	OWNER	ACTIVE	2026-08-21 03:53:41.757171+00	2026-08-21 03:53:41.757171+00	2026-08-21 03:53:41.757171+00
6ce8be4c-825b-49f2-9e3c-22fffa9c203b	6ef27787-11f2-4de0-960f-c5d9308d0e28	935a6a34-0db0-46c6-887b-694593b428b6	OWNER	ACTIVE	2026-08-21 03:53:54.403535+00	2026-08-21 03:53:54.403535+00	2026-08-21 03:53:54.403535+00
83f867c3-aa08-434b-a992-225a1d4fb9fa	00c2d92b-4a5a-4000-b15b-a888d217f4c9	60555b41-17c0-4214-8109-9c456e54c8ee	OWNER	ACTIVE	2026-08-21 04:16:00.83877+00	2026-08-21 04:16:00.83877+00	2026-08-21 04:16:00.83877+00
216fcf73-2d3d-4700-bb80-3831875c5718	a64886eb-19bc-49fd-9fc6-d2090eec44ed	25bb7d25-9c0d-44ca-8b9c-6f21fbbdff78	OWNER	ACTIVE	2026-08-21 04:16:13.18254+00	2026-08-21 04:16:13.18254+00	2026-08-21 04:16:13.18254+00
c48810f7-31b3-47db-a21b-16709b5bfb59	161b2af3-20d7-48f9-8a93-f1955402178c	0f34dc28-70b8-4fee-a76d-a1ec900d1252	OWNER	ACTIVE	2026-08-21 11:22:42.776668+00	2026-08-21 11:22:42.776669+00	2026-08-21 11:22:42.776669+00
3c0f8ed0-a0d4-4341-b36e-ace85119d122	1b928f7c-b6a7-4068-a392-d4f3f51fc93b	e71fb925-7467-475c-8a1f-dd79bc268a9c	OWNER	ACTIVE	2026-08-21 11:23:37.594314+00	2026-08-21 11:23:37.594314+00	2026-08-21 11:23:37.594314+00
832436b8-bfeb-4372-b77e-f8dbc7994daa	76d852b2-31fd-42a0-a775-499b1e547358	d7c41ecc-6755-4c28-9b5f-c4c6aff42281	OWNER	ACTIVE	2026-08-21 11:24:34.145134+00	2026-08-21 11:24:34.145134+00	2026-08-21 11:24:34.145135+00
53f5885a-626b-4029-a29d-f6db12fc640f	88810add-fec9-4976-88bb-733ba17081c9	614450d8-cee7-4a67-913f-6daa0503ab41	OWNER	ACTIVE	2026-08-21 11:33:28.988566+00	2026-08-21 11:33:28.988566+00	2026-08-21 11:33:28.988566+00
186228e4-0a13-4124-84cd-0245f8ee15d2	10f488ae-e546-407e-ad82-96efb18466c6	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	OWNER	ACTIVE	2026-08-21 11:40:25.372805+00	2026-08-21 11:40:25.372805+00	2026-08-21 11:40:25.372805+00
c6f4da64-09cd-40dd-a347-19dbbfddc4ba	10f488ae-e546-407e-ad82-96efb18466c6	34f536ff-c14c-4a57-a933-930518d428e2	OWNER	ACTIVE	2026-08-21 11:41:08.746487+00	2026-08-21 11:41:08.746487+00	2026-08-21 11:41:08.746488+00
9f6a48c2-2f0d-4455-95a8-65862af4a544	a0de438d-d002-40e3-bbf8-4f6db93d2806	bab467a1-e9e0-4ea3-a359-457abbd06c79	OWNER	ACTIVE	2026-08-21 11:51:27.298861+00	2026-08-21 11:51:27.298861+00	2026-08-21 11:51:27.298861+00
f1e278d6-875d-424e-a8a8-9684d1d086ed	a0de438d-d002-40e3-bbf8-4f6db93d2806	7fc85c33-b7d8-4f74-aa8c-2ff49949045e	OWNER	ACTIVE	2026-08-21 11:51:34.307576+00	2026-08-21 11:51:34.307576+00	2026-08-21 11:51:34.307577+00
f9afc81c-dff6-4028-ae94-38df89bc2484	deff6045-e0b5-4005-8333-9c22e88edc61	50afee23-0ac7-4bbd-96b2-ec28eea43751	OWNER	ACTIVE	2026-08-21 11:53:46.825642+00	2026-08-21 11:53:46.825642+00	2026-08-21 11:53:46.825642+00
39adaa53-866b-415a-bea5-507f9a668660	deff6045-e0b5-4005-8333-9c22e88edc61	b27a0072-0bac-42bb-adde-e734a3070ee8	OWNER	ACTIVE	2026-08-21 11:53:53.650066+00	2026-08-21 11:53:53.650066+00	2026-08-21 11:53:53.650066+00
88161fac-3c64-475c-9eb3-25e7b3ba32d2	e271741f-799d-49b0-ac63-8e382d67fc6c	53b8d3b9-f8dd-4337-8719-97edc9e449b5	OWNER	ACTIVE	2026-08-21 11:54:28.578837+00	2026-08-21 11:54:28.578837+00	2026-08-21 11:54:28.578837+00
c8a4db2c-877b-4c4b-bde0-617afbb0290b	dec18fe0-92d5-4faf-98db-9c5d615fdace	c87d9849-bca1-4328-abe3-793233aadf36	OWNER	ACTIVE	2026-08-21 14:02:57.672604+00	2026-08-21 14:02:57.672604+00	2026-08-21 14:02:57.672604+00
13c80802-bbc9-4757-b2db-7937b34a8a0f	dae3304d-d7b9-46e0-adb4-0f7b023a9500	b67bd1b2-d12a-486b-a287-82f120598b7c	OWNER	ACTIVE	2026-08-21 14:09:19.770927+00	2026-08-21 14:09:19.770927+00	2026-08-21 14:09:19.770927+00
d4e29e24-b05f-416a-935b-01e57078da84	c18774e1-d8f5-40f5-8582-f2b9b55912e7	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	OWNER	ACTIVE	2026-08-21 14:10:27.888896+00	2026-08-21 14:10:27.888896+00	2026-08-21 14:10:27.888896+00
8c0164fe-3553-4002-bee4-a038ce8f8a98	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	OWNER	ACTIVE	2026-08-21 14:13:07.142231+00	2026-08-21 14:13:07.142231+00	2026-08-21 14:13:07.142231+00
d607e742-ab53-42b3-86d0-b1e6e1f4a447	d31867cb-cc3e-49c6-ba4c-04d10901255b	aacea673-e33b-4e03-9a1d-a59c899ac662	OWNER	ACTIVE	2026-08-21 14:13:54.661622+00	2026-08-21 14:13:54.661622+00	2026-08-21 14:13:54.661622+00
1831b55e-d0ed-4862-b851-d299d3bda07d	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	704df200-1059-4f70-bfef-084c61675633	OWNER	ACTIVE	2026-08-21 14:27:48.485239+00	2026-08-21 14:27:48.485239+00	2026-08-21 14:27:48.485239+00
8036e7e9-4d13-4497-8375-f8a402cec725	53eabe9b-cf41-4444-a608-b08e85779c01	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	OWNER	ACTIVE	2026-08-21 14:28:52.595019+00	2026-08-21 14:28:52.595019+00	2026-08-21 14:28:52.595019+00
436c41b6-9d05-4a99-97a2-48e8e5b38baf	88405f91-3489-4d58-b613-296bef30e2ef	75c1e6d2-75f0-4116-88d4-ac684bda3c49	OWNER	ACTIVE	2026-08-21 22:47:39.383469+00	2026-08-21 22:47:39.383469+00	2026-08-21 22:47:39.383469+00
b0e5c6bd-9c33-4920-800a-49541ab9bbf2	6912915d-4dd3-41dd-9c46-6a0efc2afa46	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	OWNER	ACTIVE	2026-08-21 23:00:01.321943+00	2026-08-21 23:00:01.321943+00	2026-08-21 23:00:01.321943+00
a84611a8-c0c1-4aa2-847b-5675c251fbd8	4afcb35b-ebb0-492c-bc26-f4961e0c43da	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	OWNER	ACTIVE	2026-08-21 23:02:18.365725+00	2026-08-21 23:02:18.365725+00	2026-08-21 23:02:18.365725+00
78ff17e5-4125-4261-ad8c-2a8380420423	6b7cadef-8ebe-4d0d-b219-39e7614245ff	db8af7ab-c951-44ff-8445-0f2a4bad9b65	OWNER	ACTIVE	2026-08-21 23:06:24.140193+00	2026-08-21 23:06:24.140193+00	2026-08-21 23:06:24.140193+00
c4c261de-0618-4d98-ab82-b16665a4aba7	3b604540-0c86-43ad-a66b-15431c4664f5	4c266dc8-d833-48bf-831f-fdf5b3e089b6	OWNER	ACTIVE	2026-08-21 23:08:34.778254+00	2026-08-21 23:08:34.778255+00	2026-08-21 23:08:34.778255+00
5cadbc27-89fa-40c1-b515-d88013a81e6b	33ee2282-5467-4c59-ac70-b4b6a020f38f	13193bb5-b17f-4097-ba81-43005ad5c416	OWNER	ACTIVE	2026-08-22 00:18:09.132023+00	2026-08-22 00:18:09.132023+00	2026-08-22 00:18:09.132023+00
275fa964-32de-46f3-a1d6-2c637a073bcc	00c2d92b-4a5a-4000-b15b-a888d217f4c9	f09a416f-601e-4666-b24b-9a7e0adbed1e	OWNER	ACTIVE	2026-08-25 08:13:06.175841+00	2026-08-25 08:13:06.175841+00	2026-08-25 08:13:06.175841+00
0197e6ad-cfd0-40d3-b0c6-e1caf942775d	07f2e0b3-6709-4cf0-afcc-6b24db94ce93	224caa89-2d0c-405d-8e21-9a90071de100	OWNER	ACTIVE	2026-08-26 13:17:30.157921+00	2026-08-26 13:17:30.157921+00	2026-08-26 13:17:30.157921+00
a9595b6a-6cd8-4d8c-af01-806880ea7f32	2f4bb545-2f88-4326-a274-e12b0815656e	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	OWNER	ACTIVE	2026-08-26 13:19:07.144652+00	2026-08-26 13:19:07.144652+00	2026-08-26 13:19:07.144652+00
2b5e4adf-e835-459f-8989-1e2bd0459f19	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	f5bbc830-34b8-45a0-b50d-b16b0a362689	OWNER	ACTIVE	2026-08-26 13:26:41.026607+00	2026-08-26 13:26:41.026607+00	2026-08-26 13:26:41.026607+00
0d9b108a-9e52-450b-ae7e-072f2f6c51f2	df9edc86-2eac-40d6-a0b4-625385b387bc	1ba51d3e-52e7-40ec-878d-55a7d135bdad	OWNER	ACTIVE	2026-08-26 13:28:13.483374+00	2026-08-26 13:28:13.483374+00	2026-08-26 13:28:13.483374+00
58a6c48c-dc92-4e27-95c9-c3da97c20abe	f87c1ce5-6819-4d12-a0a9-85055d806ae5	f25f43bd-ab50-4b87-b053-40a6af262d5b	OWNER	ACTIVE	2026-08-26 15:20:09.247076+00	2026-08-26 15:20:09.247076+00	2026-08-26 15:20:09.247076+00
45566c74-f37d-4fca-a34c-b7ee2af2aba0	f56c4268-e4d2-4382-8e8a-8ba603e663f7	65a47cfd-4a86-4a1c-beab-63c72c97747c	OWNER	ACTIVE	2026-08-26 15:21:26.150863+00	2026-08-26 15:21:26.150863+00	2026-08-26 15:21:26.150863+00
55f9dbdb-4d00-42a9-bc81-cd6e86546b21	8700aec8-b351-4e33-845e-8254918e00ad	28158bd6-cd39-49a8-a0a9-58ec324473bc	OWNER	ACTIVE	2026-08-26 15:55:01.155062+00	2026-08-26 15:55:01.155062+00	2026-08-26 15:55:01.155062+00
\.


--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.businesses (id, name, business_type, category, phone, whatsapp, email, country, city, default_currency, status, created_at, updated_at) FROM stdin;
91eb7ec0-476f-41f3-9845-af89f864f129	Web Test Biz 045337	RETAIL	general	+243811000100		seller_web_045337@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 03:53:41.75334+00	2026-08-21 03:53:41.75334+00
935a6a34-0db0-46c6-887b-694593b428b6	Biz B 045337	RETAIL	general	+243811000200		ownerb_045337@test.com	CD	Goma	USD	ACTIVE	2026-08-21 03:53:54.401839+00	2026-08-21 03:53:54.401839+00
25bb7d25-9c0d-44ca-8b9c-6f21fbbdff78	Biz B 051556	RETAIL	general	+243811000200		ownerb_051556@test.com	CD	Goma	USD	ACTIVE	2026-08-21 04:16:13.18129+00	2026-08-21 04:16:13.18129+00
0f34dc28-70b8-4fee-a76d-a1ec900d1252	Emp Test Biz 20260821122237	RETAIL	general	+243812271937		test_owner_20260821122237@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:22:42.772059+00	2026-08-21 11:22:42.772059+00
e71fb925-7467-475c-8a1f-dd79bc268a9c	Emp Test Biz 20260821122332	RETAIL	general	+243812597566		test_owner_20260821122332@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:23:37.593586+00	2026-08-21 11:23:37.593586+00
d7c41ecc-6755-4c28-9b5f-c4c6aff42281	Emp Test Biz 20260821122429	RETAIL	general	+243812420341		test_owner_20260821122429@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:24:34.144309+00	2026-08-21 11:24:34.144309+00
614450d8-cee7-4a67-913f-6daa0503ab41	Matrix Biz 20260821123318	RETAIL	general	+243815714717		test_matrix_seller_20260821123318@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:33:28.987432+00	2026-08-21 11:33:28.987432+00
34f536ff-c14c-4a57-a933-930518d428e2	Bofi Pharma	WHOLESALE	general	+243989805612		bofigauthier3@gmail.com	CD	kinshasa	USD	ACTIVE	2026-08-21 11:41:08.744432+00	2026-08-21 11:41:08.744432+00
bab467a1-e9e0-4ea3-a359-457abbd06c79	Mega Tech DRC 20260821125121	RETAIL	electronics	+243819822494	+243819822494	seller_fulltest_20260821125121@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:51:27.296336+00	2026-08-21 11:51:27.296336+00
7fc85c33-b7d8-4f74-aa8c-2ff49949045e	Second Business 20260821125121	SERVICES	general	+243819822494	+243819822494	seller_fulltest_20260821125121@example.com	CD	Lubumbashi	USD	ACTIVE	2026-08-21 11:51:34.305961+00	2026-08-21 11:51:34.305961+00
50afee23-0ac7-4bbd-96b2-ec28eea43751	Mega Tech DRC 20260821125341	RETAIL	electronics	+243819938032	+243819938032	seller_fulltest_20260821125341@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:53:46.824293+00	2026-08-21 11:53:46.824293+00
b27a0072-0bac-42bb-adde-e734a3070ee8	Second Business 20260821125341	SERVICES	general	+243819938032	+243819938032	seller_fulltest_20260821125341@example.com	CD	Lubumbashi	USD	ACTIVE	2026-08-21 11:53:53.649006+00	2026-08-21 11:53:53.649006+00
53b8d3b9-f8dd-4337-8719-97edc9e449b5	Order Test Biz 20260821125423	RETAIL	electronics	+243819452386	+243819452386	seller_ordertest_20260821125423@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:54:28.576778+00	2026-08-21 11:54:28.576778+00
c87d9849-bca1-4328-abe3-793233aadf36	Order Test Biz 20260821150246	RETAIL	electronics	+243819313935	+243819313935	seller_ordertest_20260821150246@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:02:57.671782+00	2026-08-21 14:02:57.671782+00
b67bd1b2-d12a-486b-a287-82f120598b7c	Order Test Biz 20260821150913	RETAIL	electronics	+243819359250	+243819359250	seller_ordertest_20260821150913@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:09:19.769818+00	2026-08-21 14:09:19.769818+00
2a94d6d1-0b37-4324-9648-d2f12b4ffb43	Order Test Biz 20260821151022	RETAIL	electronics	+243819748882	+243819748882	seller_ordertest_20260821151022@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:10:27.888422+00	2026-08-21 14:10:27.888422+00
074fab6d-e5c0-434c-adf8-cb9fb4c49f97	Order Test Biz 20260821151259	RETAIL	electronics	+243819697954	+243819697954	seller_ordertest_20260821151259@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:13:07.141452+00	2026-08-21 14:13:07.141452+00
aacea673-e33b-4e03-9a1d-a59c899ac662	Order Test Biz 20260821151348	RETAIL	electronics	+243819882763	+243819882763	seller_ordertest_20260821151348@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:13:54.660895+00	2026-08-21 14:13:54.660895+00
704df200-1059-4f70-bfef-084c61675633	Order Test Biz 20260821152742	RETAIL	electronics	+243819395420	+243819395420	seller_ordertest_20260821152742@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:27:48.484383+00	2026-08-21 14:27:48.484383+00
1ad02bec-e152-4170-b5fe-29f7aa8a1e39	Order Test Biz 20260821152845	RETAIL	electronics	+243819176734	+243819176734	seller_ordertest_20260821152845@example.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 14:28:52.59432+00	2026-08-21 14:28:52.59432+00
75c1e6d2-75f0-4116-88d4-ac684bda3c49	BTMI Fashion Hub 20260821_234734	RETAIL	FASHION	+243991_2347340		seller_stock_20260821_234734@test.com	CD	Kinshasa	FC	ACTIVE	2026-08-21 22:47:39.382021+00	2026-08-21 22:47:39.382021+00
24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	BTMI Fashion Hub 20260821_235954	RETAIL	FASHION	+243991_2359540		seller_stock_20260821_235954@test.com	CD	Kinshasa	FC	ACTIVE	2026-08-21 23:00:01.320578+00	2026-08-21 23:00:01.320578+00
2804c218-88a9-4bf2-a3a9-dc73e6f1455d	BTMI Fashion Hub 20260822_000213	RETAIL	FASHION	+243992_0002130		seller_stock_20260822_000213@test.com	CD	Kinshasa	FC	ACTIVE	2026-08-21 23:02:18.364211+00	2026-08-21 23:02:18.364211+00
db8af7ab-c951-44ff-8445-0f2a4bad9b65	BTMI Fashion Hub 20260822_000616	RETAIL	FASHION	+243992_0006160		seller_stock_20260822_000616@test.com	CD	Kinshasa	FC	ACTIVE	2026-08-21 23:06:24.139189+00	2026-08-21 23:06:24.139189+00
4c266dc8-d833-48bf-831f-fdf5b3e089b6	BTMI Fashion Hub 20260822_000826	RETAIL	FASHION	+243992_0008260		seller_stock_20260822_000826@test.com	CD	Kinshasa	FC	ACTIVE	2026-08-21 23:08:34.77718+00	2026-08-21 23:08:34.77718+00
13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Flow Stores	RETAIL	GENERAL	+243988776655		flowbiz@test.com	DRC	Kinshasa	FC	ACTIVE	2026-08-22 00:18:09.130741+00	2026-08-22 00:18:09.130741+00
f09a416f-601e-4666-b24b-9a7e0adbed1e	Isolation Business 051556	RETAIL	general	+243810515560		isolation051556@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-25 08:13:06.174067+00	2026-08-25 08:13:06.174067+00
60555b41-17c0-4214-8109-9c456e54c8ee	Web Test Commerce 051556	RETAIL	general	+243811000100		seller_web_051556@test.com	CD	Kinshasa	USD	DEACTIVATED	2026-08-21 04:16:00.835129+00	2026-08-25 08:14:49.077442+00
5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	Bofi Ecom	WHOLESALE	general	243989805614		bofigauthier3@gmail.com	CD	Kinshasa	USD	ACTIVE	2026-08-21 11:40:25.355373+00	2026-08-25 08:23:23.896552+00
224caa89-2d0c-405d-8e21-9a90071de100	Sync Biz 141718	RETAIL	general	+243811000100		sync_seller_141718@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 13:17:30.153759+00	2026-08-26 13:17:30.153759+00
ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	Sync Biz 141856	RETAIL	general	+243811000100		sync_seller_141856@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 13:19:07.143252+00	2026-08-26 13:19:07.143252+00
f5bbc830-34b8-45a0-b50d-b16b0a362689	Sync Biz 142629	RETAIL	general	+243811000100		sync_seller_142629@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 13:26:41.023924+00	2026-08-26 13:26:41.023924+00
1ba51d3e-52e7-40ec-878d-55a7d135bdad	Sync Biz 142802	RETAIL	general	+243811000100		sync_seller_142802@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 13:28:13.48251+00	2026-08-26 13:28:13.48251+00
f25f43bd-ab50-4b87-b053-40a6af262d5b	Prod Biz 162002	RETAIL	general	+243811000300		prod_seller_162002@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 15:20:09.242368+00	2026-08-26 15:20:09.242368+00
65a47cfd-4a86-4a1c-beab-63c72c97747c	Prod Biz 162119	RETAIL	general	+243811000300		prod_seller_162119@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 15:21:26.150074+00	2026-08-26 15:21:26.150074+00
28158bd6-cd39-49a8-a0a9-58ec324473bc	Test Business Verify	RETAIL	general	+243900000112	+243900000112	verify_seller_0826b@test.com	CD	Kinshasa	USD	ACTIVE	2026-08-26 15:55:01.151228+00	2026-08-26 15:55:01.151228+00
\.


--
-- Data for Name: buyer_levels; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.buyer_levels (id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description, created_at) FROM stdin;
a0000000-0000-0000-0000-000000000001	BRONZE	0	499	0.00	0.00	f	Normal marketplace experience	2026-08-18 13:56:28.564954
a0000000-0000-0000-0000-000000000002	SILVER	500	1999	1.00	0.00	f	Small marketplace benefit	2026-08-18 13:56:28.564954
a0000000-0000-0000-0000-000000000003	GOLD	2000	4999	3.00	0.00	f	Better purchase benefit	2026-08-18 13:56:28.564954
a0000000-0000-0000-0000-000000000004	PLATINUM	5000	9999	5.00	2.00	f	Higher discount, delivery discount	2026-08-18 13:56:28.564954
a0000000-0000-0000-0000-000000000005	DIAMOND	10000	99999999	7.00	5.00	t	Highest discount, free delivery, special offers	2026-08-18 13:56:28.564954
\.


--
-- Data for Name: buyer_payments; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.buyer_payments (id, order_id, business_id, shop_id, buyer_profile_id, payment_method, currency, products_base_total, products_points_used, products_points_discount, products_final_total, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final, cash_due, buyer_confirmed, buyer_confirmed_at, seller_confirmed, seller_confirmed_by, seller_confirmed_at, status, verified_at, created_at, updated_at) FROM stdin;
06cc9119-980b-478f-9bed-ad8652b9f457	89b0f950-c5fe-4059-b23d-987a88eeddaa	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	4364cacd-338e-4bcf-ae7d-b8f21a857fb9	CASH	CDF	15000.00	0	0.00	15000.00	0.00	0	0.00	0.00	15000.00	t	2026-08-21 03:53:55.709737+00	t	4ad3d1d8-8224-48e3-a15f-efd114544a97	2026-08-21 03:53:55.735734+00	VERIFIED	2026-08-21 03:53:55.735734+00	2026-08-21 03:53:55.681503+00	2026-08-21 03:53:55.739103+00
6b1bed74-6364-4044-abe2-c01c12333e01	8ec221fe-1463-45a3-82a7-9c8bd645326b	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	CASH	CDF	15000.00	0	0.00	15000.00	0.00	0	0.00	0.00	15000.00	t	2026-08-21 04:16:14.23981+00	t	00c2d92b-4a5a-4000-b15b-a888d217f4c9	2026-08-21 04:16:14.268619+00	VERIFIED	2026-08-21 04:16:14.268619+00	2026-08-21 04:16:14.221671+00	2026-08-21 04:16:14.271238+00
b23453a8-b119-45f6-8b68-bcf45a9180f9	bf550b83-e695-41f1-8545-795dac015ff9	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	cfa4847c-bc06-4f1a-8791-c96d71b61579	CASH	CDF	180000.00	0	0.00	180000.00	0.00	0	0.00	0.00	180000.00	t	2026-08-25 07:43:37.723132+00	f	\N	\N	CONFIRMED	\N	2026-08-25 07:42:54.597494+00	2026-08-25 07:43:37.724808+00
3bd9cd15-19a2-4f7f-b974-fa021a537391	e916a98d-8162-47e1-9193-e08db1f3ac47	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	CASH	CDF	15000.00	0	0.00	15000.00	2000.00	0	0.00	2000.00	17000.00	t	2026-08-25 08:01:24.615025+00	t	00c2d92b-4a5a-4000-b15b-a888d217f4c9	2026-08-25 08:01:24.623497+00	VERIFIED	2026-08-25 08:01:24.623497+00	2026-08-25 08:01:24.536532+00	2026-08-25 08:01:24.623939+00
f2d50405-4f64-44a5-9a00-27204c14af16	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	CASH	CDF	15000.00	0	0.00	15000.00	0.00	0	0.00	0.00	15000.00	t	2026-08-25 08:01:46.906648+00	t	00c2d92b-4a5a-4000-b15b-a888d217f4c9	2026-08-25 08:01:46.915238+00	VERIFIED	2026-08-25 08:01:46.915238+00	2026-08-25 08:01:46.89549+00	2026-08-25 08:01:46.915973+00
2a8f1091-4b86-40f5-823b-d960af307d9a	9bfe4f32-bac3-4835-8db3-5b469e7d643c	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	cfa4847c-bc06-4f1a-8791-c96d71b61579	CASH	CDF	15600.00	3	3000.00	12600.00	0.00	0	0.00	0.00	12600.00	t	2026-08-26 10:41:34.63466+00	t	10f488ae-e546-407e-ad82-96efb18466c6	2026-08-26 11:06:38.230205+00	VERIFIED	2026-08-26 11:06:38.230205+00	2026-08-26 10:41:28.189872+00	2026-08-26 11:06:38.23264+00
f75aa49c-54fc-4ffc-af05-b9cd830fb17f	ba31f915-0007-4151-9b8b-685c5f7d345f	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	fef7e933-b5da-4e4e-bd37-32157e61a0a0	CASH	CDF	50000.00	0	0.00	50000.00	0.00	0	0.00	0.00	50000.00	t	2026-08-26 13:26:41.518504+00	t	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	2026-08-26 13:26:41.914978+00	VERIFIED	2026-08-26 13:26:41.914978+00	2026-08-26 13:26:41.493442+00	2026-08-26 13:26:41.915793+00
75f17b78-4173-4b15-9dd1-a8f28a034796	77f12fc6-8628-451a-aec5-594095c83891	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	fef7e933-b5da-4e4e-bd37-32157e61a0a0	CASH	CDF	50000.00	0	0.00	50000.00	2000.00	0	0.00	2000.00	52000.00	t	2026-08-26 13:26:45.10019+00	t	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	2026-08-26 13:26:45.110603+00	VERIFIED	2026-08-26 13:26:45.110603+00	2026-08-26 13:26:45.09176+00	2026-08-26 13:26:45.111461+00
ebc14509-3a71-43fe-971b-c2dbab27a1dd	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	CASH	CDF	50000.00	0	0.00	50000.00	0.00	0	0.00	0.00	50000.00	t	2026-08-26 13:28:13.889372+00	t	df9edc86-2eac-40d6-a0b4-625385b387bc	2026-08-26 13:28:14.303225+00	VERIFIED	2026-08-26 13:28:14.303225+00	2026-08-26 13:28:13.876976+00	2026-08-26 13:28:14.30404+00
9b785bbb-d17e-475a-adc1-ecfdf03d5539	739c79ab-9b9f-4d54-bc16-830e967f149a	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	CASH	CDF	50000.00	0	0.00	50000.00	2000.00	0	0.00	2000.00	52000.00	t	2026-08-26 13:28:17.487161+00	t	df9edc86-2eac-40d6-a0b4-625385b387bc	2026-08-26 13:28:17.503067+00	VERIFIED	2026-08-26 13:28:17.503067+00	2026-08-26 13:28:17.477596+00	2026-08-26 13:28:17.503786+00
543b33a5-c591-4275-a9ae-6d6add48ce50	93e8de5a-2b9b-4b98-b968-8a15369789eb	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	5fa6e0ec-098a-417d-856f-187eb5aeaa4b	CASH	CDF	50000.00	0	0.00	50000.00	5.00	0	0.00	5.00	50005.00	t	2026-08-26 18:34:56.460536+00	t	8700aec8-b351-4e33-845e-8254918e00ad	2026-08-26 18:35:10.03582+00	VERIFIED	2026-08-26 18:35:10.03582+00	2026-08-26 18:34:39.635885+00	2026-08-26 18:35:10.03832+00
\.


--
-- Data for Name: buyer_profiles; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.buyer_profiles (id, user_id, first_name, last_name, phone, email, city, commune, status, created_at, updated_at, backup_phone, address) FROM stdin;
4364cacd-338e-4bcf-ae7d-b8f21a857fb9	9fbf0cc2-ae16-45fb-a3e0-7fc1db4b4bc7	Buyer	T	+243999000111	buyer_web_045337@test.com	Kinshasa	Gombe	ACTIVE	2026-08-21 03:53:55.395508	2026-08-21 03:53:55.395508		
361c8152-eadd-4fb2-8dd0-12054658f348	10f488ae-e546-407e-ad82-96efb18466c6	gauthier	bofi	+243989805612	bofigauthier3@gmail.com			ACTIVE	2026-08-21 11:08:46.54925	2026-08-21 11:08:46.54925		
1d276ca9-6099-4f30-9798-3b84541bbaba	2f7f19dc-5d38-4642-a3d8-4c1ed2e11d8c	Buyer	Tester	+243818497695	buyer_ordertest_20260821150913@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:09:25.564504	2026-08-21 14:09:25.564504		
8ad7ceaa-1628-4cba-9944-a2614fa76f5a	ad91281f-138a-411c-ada1-8d11f4625237	Buyer	Tester	+243818702107	buyer_ordertest_20260821151022@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:10:33.155355	2026-08-21 14:10:33.155355		
784d5a8f-9f29-421b-b035-2b13beefecdb	79684130-93c3-44c7-a9c9-b3c313449da5	Buyer	Tester	+243818124061	buyer_ordertest_20260821151259@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:13:13.721698	2026-08-21 14:13:13.721698		
da0a8d9f-bbcd-4289-bb0d-5e7cad42b998	fea3d9d4-bb12-4a43-8d31-347af8c4e20d	Buyer	Tester	+243818329182	buyer_ordertest_20260821151348@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:14:02.227686	2026-08-21 14:14:02.227686		
da41db1c-5d58-4662-a2dc-24ca29b14ec2	2eeaca0b-ca2c-4c5d-8a40-7781627b2bf2	Buyer	Tester	+243818889391	buyer_ordertest_20260821152742@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:27:56.170223	2026-08-21 14:27:56.170223		
f091a1b0-7b3e-49fb-ac32-4a80925d11f3	8dce0e1e-2356-4798-be5d-0c2224a69939	Buyer	Tester	+243818531150	buyer_ordertest_20260821152845@example.com	Kinshasa	Gombe	ACTIVE	2026-08-21 14:29:06.546979	2026-08-21 14:29:06.546979		
922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	Buyer	T	+243812345678	buyer_web_051556@test.com	Kinshasa	Bandalungwa	ACTIVE	2026-08-21 04:16:14.031705	2026-08-25 08:27:10.323436	+243999456789	12 Avenue Kasa-Vubu
cfa4847c-bc06-4f1a-8791-c96d71b61579	ae2e7050-4bc6-407b-b670-98d82a215b9b	impoke	johnson	9157905812	johnsonimpoke@gmail.com	Kinshasa	Bandalungwa	ACTIVE	2026-08-24 15:09:17.463338	2026-08-25 08:39:26.055525		Facochere 10
6ab62b64-af3b-4f3b-9d53-5e38cad0051f	54998434-5ff1-413a-91fd-c928cfbae493	Sync	Buyer	+243999000111	sync_buyer_141718@test.com	Kinshasa	Gombe	ACTIVE	2026-08-26 13:17:30.371444	2026-08-26 13:17:30.371444		
58b991ef-ee6a-40d9-a95e-66f2cf4754b3	d440befb-c451-4c38-95f1-ba5c057ca0d9	Sync	Buyer	+243999000111	sync_buyer_141856@test.com	Kinshasa	Gombe	ACTIVE	2026-08-26 13:19:07.24018	2026-08-26 13:19:07.24018		
fef7e933-b5da-4e4e-bd37-32157e61a0a0	5593d59e-3cc5-4da3-955d-80f2cbbca1fd	Sync	Buyer	+243999000111	sync_buyer_142629@test.com	Kinshasa	Gombe	ACTIVE	2026-08-26 13:26:41.118636	2026-08-26 13:26:41.118636		
4a0fc13b-85c0-4609-acbb-9a42b2670c8e	5384da9a-5b5b-4df0-9063-7cbb8cd163ff	Sync	Buyer	+243999000111	sync_buyer_142802@test.com	Kinshasa	Gombe	ACTIVE	2026-08-26 13:28:13.552131	2026-08-26 13:28:13.552131		
5fa6e0ec-098a-417d-856f-187eb5aeaa4b	1bb14759-9967-4d6c-8a65-91e91731f726	Android	Buyer	+243900111222	android_buyer_193304@test.com	Kinshasa	Gombe	ACTIVE	2026-08-26 18:33:38.618101	2026-08-26 18:33:38.618101		12 Av. Test
\.


--
-- Data for Name: cash_payments; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.cash_payments (id, business_id, shop_id, employee_id, customer_id, cash_session_id, reference_type, reference_id, amount, currency, status, created_at, updated_at) FROM stdin;
702f116a-a6af-4dcf-ae94-4a57f539f142	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	\N	ae571fa4-9638-4437-9728-fd2a5319ad93	\N	ORDER	39f14eb2-a16b-44fe-a546-2701fee2b128	15000.00	USD	CONFIRMED	2026-08-21 03:53:51.330514+00	2026-08-21 03:53:51.330514+00
4bc22288-ff85-491c-8ed7-59dbffe06337	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	\N	62b66e54-598d-4e74-91de-a2cd365ebffd	\N	ORDER	0bd192ee-550f-477c-bdd5-ba890b037d48	15000.00	USD	CONFIRMED	2026-08-21 04:16:10.580042+00	2026-08-21 04:16:10.580042+00
\.


--
-- Data for Name: cash_sessions; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.cash_sessions (id, business_id, shop_id, employee_id, opened_at, closed_at, opening_amount, currency, cash_sales_total, expected_amount, declared_closing_amount, difference, reconciliation_result, status, created_at, updated_at) FROM stdin;
2c4d14c8-eb99-43fd-b65a-bbf62f948ac7	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	\N	2026-08-21 03:53:50.859778+00	2026-08-21 03:53:50.896381+00	10000.00	USD	0.00	10000.00	10000.00	0.00	MATCHED	RECONCILED	2026-08-21 03:53:50.860652+00	2026-08-21 03:53:50.929361+00
25b92423-3fa1-47f9-a759-42372b7ba772	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	\N	2026-08-21 04:16:10.331126+00	2026-08-21 04:16:10.356521+00	10000.00	USD	0.00	10000.00	10000.00	0.00	MATCHED	RECONCILED	2026-08-21 04:16:10.332175+00	2026-08-21 04:16:10.375825+00
7000ad51-081f-4e62-8e6d-43232d4d6ad3	50afee23-0ac7-4bbd-96b2-ec28eea43751	9a6760d2-8c80-4836-8fb1-2573f37417d3	\N	2026-08-21 11:53:53.435609+00	2026-08-21 11:53:53.51152+00	150.00	USD	0.00	0.00	150.00	\N	\N	CLOSED	2026-08-21 11:53:53.436476+00	2026-08-21 11:53:53.511852+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.categories (id, name, slug, status, sort_order, created_at, updated_at) FROM stdin;
34ee875b-0c79-4eef-897d-dac1cd07cad1	Fashion	fashion	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
e2492a82-8005-467f-af8e-e352caf26067	Children	children	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
342aa21d-5919-4139-a189-3461ccc96c48	Electronics	electronics	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
1c78e8b4-9665-4faa-b158-3ff6fe77f517	Home	home	ACTIVE	4	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
2452f078-5c79-4dde-a7d4-1e9afab17bc9	Beauty	beauty	ACTIVE	5	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
1b94f540-a42b-4833-be2e-33ff44454be0	Food	food	ACTIVE	6	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
a77da559-9b31-4b96-a01b-08c7c585630d	Sport	sport	ACTIVE	7	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
7d4a48d7-9517-4986-a081-838b97c9b21c	Automotive	automotive	ACTIVE	8	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
c09b3b4a-cfe3-4e3d-826a-f7d45fa61f14	Services	services	ACTIVE	9	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
55555555-5555-5555-5555-555555555555	Shoes	shoes	ACTIVE	1	2026-08-18 14:22:15.110521+00	2026-08-18 14:22:15.110521+00
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.customers (id, business_id, first_name, last_name, phone, email, status, created_at, updated_at) FROM stdin;
ae571fa4-9638-4437-9728-fd2a5319ad93	91eb7ec0-476f-41f3-9845-af89f864f129	Jean	Client	+243822000999	jean.client@test.com	ACTIVE	2026-08-21 03:53:50.739299+00	2026-08-21 03:53:50.766124+00
62b66e54-598d-4e74-91de-a2cd365ebffd	60555b41-17c0-4214-8109-9c456e54c8ee	Jean	Client	+243822000999	jean.client@test.com	ACTIVE	2026-08-21 04:16:10.273022+00	2026-08-21 04:16:10.285159+00
2f2b0328-d226-4f29-a802-9cf295af2de0	bab467a1-e9e0-4ea3-a359-457abbd06c79	Nadine	Tshilombo	+243818498152	client_20260821125121@example.com	ACTIVE	2026-08-21 11:51:33.382535+00	2026-08-21 11:51:33.382535+00
abb267e8-8a1c-49d1-84b9-47cc2b1e8408	50afee23-0ac7-4bbd-96b2-ec28eea43751	Nadine	Tshilombo	+243818180356	client_20260821125341@example.com	ACTIVE	2026-08-21 11:53:53.378049+00	2026-08-21 11:53:53.378049+00
\.


--
-- Data for Name: employee_activation_tokens; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.employee_activation_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: employee_invitations; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.employee_invitations (id, employee_id, token_hash, status, expires_at, accepted_at, created_at) FROM stdin;
48fc1ad8-7425-46a6-ae17-df902a984b0e	06c2aad0-5165-4047-8fba-eff5bfff0924	ced47aa0a69d5c20347c309275643d355a7aac3adb7f5321662fcc033cca157f	ACCEPTED	2026-08-28 03:53:51.403032+00	2026-08-21 03:53:52.369636+00	2026-08-21 03:53:51.403503+00
4a8c28d1-d969-477d-82d7-2676ac8cdaaa	2115d04d-f76c-4646-a973-40bb97bf3809	fc4d56ae5446cea8d7d4bba1862735c1cf32f04d117f4b40b938edca1b57b9a1	ACCEPTED	2026-08-28 04:16:10.646218+00	2026-08-21 04:16:11.593822+00	2026-08-21 04:16:10.64769+00
01c1253b-f3eb-4e5c-8e54-56f32ab45d20	77075c37-ce82-476a-8c70-09fea05132d3	63e3cd5943b621bb2c0ff9b5ff5d0d84541eba11c289d1911ffd4d4131a30e10	PENDING	2026-08-28 11:23:37.624574+00	\N	2026-08-21 11:23:37.624799+00
4223ccc4-0ed9-40e2-a0b4-36b0a5dc5987	ef3ec2c0-ced0-4cdf-aee3-7fa67b825222	4fdce518c28f8c1a35080429bd11f50e94c5892c07679c9e9a011103a2cb8119	PENDING	2026-08-28 11:24:34.166046+00	\N	2026-08-21 11:24:34.166456+00
f20aa933-13f7-44ba-bf33-ea334e3cb1c4	ba552976-f5e6-4039-986c-c31265e010cb	b3acc71a3279c6a9fd7b33c04049adf989c3efede1e3050239cbfb0dc5b5ca1b	ACCEPTED	2026-08-28 11:33:29.022058+00	2026-08-21 11:33:33.256195+00	2026-08-21 11:33:29.022434+00
d30d8500-c25d-43d5-903b-d649be67c26c	c409ccea-7ae7-47a5-ada2-04d441da8781	baca60afbf427fff68f128623c152167d4636114e6c4db0be0be5e049009a644	PENDING	2026-08-28 11:51:29.796897+00	\N	2026-08-21 11:51:29.79755+00
d43d1461-10c3-497a-9a87-d527f1a9fd17	b6179386-f10f-4eed-9d24-454a3cee4d97	552adfd138471c4c83f252a84831450ad12913d2498a9df405e5037703087490	PENDING	2026-08-28 11:53:49.87414+00	\N	2026-08-21 11:53:49.874534+00
\.


--
-- Data for Name: employee_shop_assignments; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.employee_shop_assignments (id, employee_id, shop_id, assigned_by, status, assigned_at, created_at, updated_at) FROM stdin;
ddfa325c-f96f-44bc-ac38-20097b661b63	06c2aad0-5165-4047-8fba-eff5bfff0924	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	4ad3d1d8-8224-48e3-a15f-efd114544a97	ACTIVE	2026-08-21 03:53:51.367698+00	2026-08-21 03:53:51.368277+00	2026-08-21 03:53:51.368277+00
a1e1a4f9-6bc5-412c-adc2-67052aa847e4	c409ccea-7ae7-47a5-ada2-04d441da8781	a372e99f-0dce-47eb-982b-1d28eb17a256	a0de438d-d002-40e3-bbf8-4f6db93d2806	ACTIVE	2026-08-21 11:51:29.767158+00	2026-08-21 11:51:29.767793+00	2026-08-21 11:51:29.767793+00
48667ea3-305b-4e0c-a10b-2256c4db4644	b6179386-f10f-4eed-9d24-454a3cee4d97	9a6760d2-8c80-4836-8fb1-2573f37417d3	deff6045-e0b5-4005-8333-9c22e88edc61	ACTIVE	2026-08-21 11:53:49.855176+00	2026-08-21 11:53:49.855605+00	2026-08-21 11:53:49.855605+00
4c9cb817-c8c0-4198-afde-8b8ff5e7b18b	2115d04d-f76c-4646-a973-40bb97bf3809	1de90a97-8fe4-4b43-abbc-19dddc868239	00c2d92b-4a5a-4000-b15b-a888d217f4c9	INACTIVE	2026-08-21 04:16:10.614445+00	2026-08-21 04:16:10.615058+00	2026-08-25 08:14:49.077442+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.employees (id, business_id, linked_user_id, first_name, middle_name, last_name, phone, email, job_title, status, created_at, updated_at) FROM stdin;
06c2aad0-5165-4047-8fba-eff5bfff0924	91eb7ec0-476f-41f3-9845-af89f864f129	1a71c2be-c812-4d18-8291-e8cc3b43e017	Emp		One	+24383333701	emp_web_045337@test.com	Sales Clerk	ACTIVE	2026-08-21 03:53:51.34827+00	2026-08-21 03:53:52.36484+00
030b36e9-9a05-49d1-b161-208a52c0f964	0f34dc28-70b8-4fee-a76d-a1ec900d1252	\N	EmpFirst		EmpLast	+243813516759	test_emp_20260821122237@example.com		ACTIVE	2026-08-21 11:22:42.80599+00	2026-08-21 11:22:42.80599+00
77075c37-ce82-476a-8c70-09fea05132d3	e71fb925-7467-475c-8a1f-dd79bc268a9c	\N	EmpFirst		EmpLast	+243813298660	test_emp_20260821122332@example.com	Sales	ACTIVE	2026-08-21 11:23:37.610229+00	2026-08-21 11:23:37.610229+00
ef3ec2c0-ced0-4cdf-aee3-7fa67b825222	d7c41ecc-6755-4c28-9b5f-c4c6aff42281	\N	EmpFirst		EmpLast	+243813474221	test_emp_20260821122429@example.com	Sales	ACTIVE	2026-08-21 11:24:34.156521+00	2026-08-21 11:24:34.156521+00
ba552976-f5e6-4039-986c-c31265e010cb	614450d8-cee7-4a67-913f-6daa0503ab41	d7f02ea1-97ab-443a-b162-4ff931ca2a25	EmpMatrix		User	+243817940147	test_matrix_emp_20260821123318@example.com	Staff	ACTIVE	2026-08-21 11:33:29.006487+00	2026-08-21 11:33:33.253399+00
c409ccea-7ae7-47a5-ada2-04d441da8781	bab467a1-e9e0-4ea3-a359-457abbd06c79	\N	Cedric		Bakambu	+243817197331	staff_20260821125121@example.com	Store Assistant	ACTIVE	2026-08-21 11:51:29.498439+00	2026-08-21 11:51:29.498439+00
b6179386-f10f-4eed-9d24-454a3cee4d97	50afee23-0ac7-4bbd-96b2-ec28eea43751	\N	Cedric		Bakambu	+243817897682	staff_20260821125341@example.com	Store Assistant	ACTIVE	2026-08-21 11:53:49.553483+00	2026-08-21 11:53:49.553483+00
2115d04d-f76c-4646-a973-40bb97bf3809	60555b41-17c0-4214-8109-9c456e54c8ee	ddabcdf3-c71d-4b0a-8493-96ee7f68bdc9	Emp		One	+24383355601	emp_web_051556@test.com	Sales Clerk	INACTIVE	2026-08-21 04:16:10.599092+00	2026-08-25 08:14:49.077442+00
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.inventory (id, business_id, shop_id, product_id, quantity, reserved_quantity, created_at, updated_at, variant_id) FROM stdin;
96265ae7-6e19-46a5-8340-2f497ef450f3	704df200-1059-4f70-bfef-084c61675633	34c98649-b1f3-416f-a1d8-3e5c3094926f	a3de5bac-a9e5-4477-b8a2-401cf10aaca5	10	2	2026-08-21 14:27:48.517852+00	2026-08-21 14:27:56.186495+00	ce60c606-4b61-4229-90b3-edee744e95d1
0d3fddea-963c-4776-9041-b98747fda9f1	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	57ccb6cb-92a9-4acc-ad5e-27ca5bfd96b8	65b6df58-93f5-434c-85c9-97eda93bcc2c	10	2	2026-08-21 14:28:52.619236+00	2026-08-21 14:29:06.563046+00	d0d5a904-a30c-431b-b1fd-03a2a532fa2f
a13598bf-066c-4b73-a288-7a8b290674d0	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	b126a114-7182-4368-8aab-31521247e520	35	0	2026-08-21 22:47:39.473865+00	2026-08-21 22:47:39.979368+00	b7dbb717-98c7-47cf-8e13-11d1396c4682
ffb37f90-300c-4ea9-b1b2-b2c35837b84a	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	10	0	2026-08-21 22:47:40.341398+00	2026-08-21 22:47:40.341398+00	d46c924b-699a-4f1d-b740-e02eefc1f4c5
d4a7dbd1-5e2c-47cb-a280-478b01afcbcf	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	5	0	2026-08-21 22:47:40.351789+00	2026-08-21 22:47:40.351789+00	074f6dc4-5507-4d0d-88ff-9c6506418dc3
de0c28df-6e25-49d0-a821-36c17a5cd8d9	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	3	0	2026-08-21 22:47:40.360116+00	2026-08-21 22:47:40.360116+00	46c25f23-409c-4b7b-8704-71cc503ca2eb
75940e36-aafe-4d2e-badb-d5800052e6a4	75c1e6d2-75f0-4116-88d4-ac684bda3c49	b7f43f8f-56cf-415e-8605-9d34f4b1854b	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	7	0	2026-08-21 22:47:41.882001+00	2026-08-21 22:47:41.882001+00	d46c924b-699a-4f1d-b740-e02eefc1f4c5
3ded997c-2b64-420e-a59b-f25217f26dba	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	5	0	2026-08-22 00:18:09.612019+00	2026-08-22 00:18:09.612019+00	b149227d-9a59-4832-85ed-2f06435ef853
05bb6a09-4dc6-4888-aeca-24147adcb905	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	17dcb70b-f466-4c0e-9661-d0d66d24a99e	35	0	2026-08-21 23:00:01.553901+00	2026-08-21 23:00:02.363191+00	088c22d5-b539-49a0-b902-15395dc6680f
457b0b60-6231-46ff-a09f-4574aaa15a31	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	10	0	2026-08-21 23:00:03.057528+00	2026-08-21 23:00:03.057528+00	3e8d12fd-1095-443a-96b2-489b75e42172
e371bad6-7fe3-4229-a37e-eb929e111096	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	5	0	2026-08-21 23:00:03.07702+00	2026-08-21 23:00:03.07702+00	764c1d2c-3f16-4152-9bbe-c7d4958bee95
e4af05e8-d647-4cb2-878c-ca2cff129a60	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	3	0	2026-08-21 23:00:03.093332+00	2026-08-21 23:00:03.093332+00	318f9648-aa93-4875-ae58-3c5a201c2af9
2ebb2e10-aec1-477d-9925-e1b7a3955a83	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	fc8cd092-835b-4a2c-9108-62554663a205	e7ec9354-f20c-420c-a9be-7e74a8347718	7	0	2026-08-21 23:00:05.869051+00	2026-08-21 23:00:05.869051+00	3e8d12fd-1095-443a-96b2-489b75e42172
b60dfcad-5433-4cc0-8c74-e5e53586df8a	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	0	0	2026-08-21 03:53:42.548546+00	2026-08-21 03:53:46.50474+00	91a9851b-fa50-4949-b766-f9ebd1cb3b96
c4fc0455-6d36-48d0-a758-29fbb0b7983d	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	3	0	2026-08-22 00:18:09.620134+00	2026-08-22 00:18:09.620134+00	6addcdb7-adbc-4d0b-96ea-1516efdd4037
9ca44a88-ad2b-4e77-9ea2-3152fc58783f	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	1fd17e3f-6d5f-40ce-938d-1d2ecb4cf30b	35	0	2026-08-21 23:02:18.575887+00	2026-08-21 23:02:19.510654+00	c5705744-a9bf-4748-88c9-be7d52058c48
e05d162c-aa63-4898-add3-c27f0967a6cb	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	10	0	2026-08-21 23:02:20.15015+00	2026-08-21 23:02:20.15015+00	d186f275-a10e-4da3-ab9e-93a5c39e7c41
004190be-cc5c-45e1-817d-9c33cc9bfeef	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	5	0	2026-08-21 23:02:20.166096+00	2026-08-21 23:02:20.166096+00	624e2cdf-4dab-4b59-9c65-738fdf116353
edbcc783-3eea-4c15-935c-a5bc38fd4cd4	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	3	0	2026-08-21 23:02:20.183065+00	2026-08-21 23:02:20.183065+00	7bd20943-b7d5-426f-a2f2-c98dd47643cc
3ae44332-5074-44e2-9cd8-fe3480df8abf	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	28	0	2026-08-21 03:53:42.385052+00	2026-08-21 03:53:56.080266+00	fec4d682-103b-41e8-90cc-ec40edd3e599
d5751fe9-1048-411f-b02d-2e38dc365282	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	ab4e24a3-bcbc-44b9-8116-8afcff1c37a1	0e30738e-1e1b-4be5-8329-f42679c3960c	7	0	2026-08-21 23:02:22.903971+00	2026-08-21 23:02:22.903971+00	d186f275-a10e-4da3-ab9e-93a5c39e7c41
a545a3d9-e7c6-4ea3-b2ec-26ffdaaf6fac	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	0	0	2026-08-21 04:16:01.846879+00	2026-08-21 04:16:06.849901+00	1c15bd3a-b1bd-4279-a951-7eeae218315a
8bd2568b-420a-43f7-940f-1b4c9cecbc61	13193bb5-b17f-4097-ba81-43005ad5c416	9239d434-08e4-44b9-ba04-5e91a1aba9eb	e6340d1c-60c7-4f28-a626-fecc0f511f71	12	0	2026-08-22 00:18:09.642773+00	2026-08-22 00:18:09.642773+00	a6213ce1-3fd0-432d-963d-ea6ff404c55b
6aab1dba-642d-4df7-be96-4ddad07052b0	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	d6fd5969-db07-4457-b2fd-2eece6337fba	35	0	2026-08-21 23:06:24.287542+00	2026-08-21 23:06:25.038206+00	2121ddfa-cbe1-4bd0-8191-92c9e3dd996e
6c524647-e134-4981-8f6a-969ed9d19915	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	5	0	2026-08-21 23:06:25.546801+00	2026-08-21 23:06:25.546801+00	1df5150e-af56-4819-b973-2ca810e8e76d
68e35329-e507-4fa8-b68a-be3e5b7efe4b	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	3	0	2026-08-21 23:06:25.560351+00	2026-08-21 23:06:25.560351+00	324c142f-f906-44fd-b28b-331b1afdcada
6a877b29-c9ce-45bc-a1d3-f297eb3b054c	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	26	0	2026-08-21 04:16:01.583511+00	2026-08-25 08:01:47.279085+00	693e071f-962d-482e-92b0-872d35d1586c
db62db33-3efb-43d4-afed-a416a8d89704	bab467a1-e9e0-4ea3-a359-457abbd06c79	a372e99f-0dce-47eb-982b-1d28eb17a256	8c1f8d4b-d0f7-46f5-8cfb-8d8cd344e43b	30	0	2026-08-21 11:51:28.830039+00	2026-08-21 11:51:28.830039+00	75e13a20-ebc4-4ded-84e0-3e5f041b7632
45ce53e0-97c5-41bb-a45e-daca1b29ddf8	50afee23-0ac7-4bbd-96b2-ec28eea43751	9a6760d2-8c80-4836-8fb1-2573f37417d3	3004215d-01d4-49d4-97b6-5da83aad569d	30	0	2026-08-21 11:53:48.67886+00	2026-08-21 11:53:48.67886+00	1f61c123-ce27-463b-928b-53b21233b975
49d5a0c8-3824-4c3b-86dd-e89b6f40575b	53b8d3b9-f8dd-4337-8719-97edc9e449b5	801e63b5-586b-4bcf-bfa9-f2a673aa10a8	f67232b9-af8b-434d-a175-477e009368e2	10	0	2026-08-21 11:54:28.62297+00	2026-08-21 11:54:28.62297+00	177ea894-762c-469a-b404-9e5dfe9347d1
c4116f82-fa87-453a-abe4-8be1d0536f7e	c87d9849-bca1-4328-abe3-793233aadf36	c3f436d6-7206-4032-ac9f-db0cfe52c44c	b686a6eb-5ae0-496b-a720-0e76b80d2990	10	0	2026-08-21 14:02:57.708116+00	2026-08-21 14:02:57.708116+00	7234b66b-abbc-4dc6-96aa-ef89d965b36a
9befd584-0a1d-4164-bd49-d3e9d294f811	b67bd1b2-d12a-486b-a287-82f120598b7c	034cee4a-9ff0-4f57-ab46-c4293f4cc0ca	404e9442-0a60-4126-8ac6-24a6ec4beffe	10	0	2026-08-21 14:09:19.802747+00	2026-08-21 14:09:19.802747+00	33de05da-3de1-4d82-9c8e-e8e07e539f3e
ed638ca1-edfc-4f14-a3b0-6a65d7f302fc	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	c88305b5-74ca-4761-9775-a8aac15f29f4	c88211fc-ff19-4b63-aac0-378b6006accd	10	2	2026-08-21 14:10:27.906735+00	2026-08-21 14:10:33.170376+00	6581e9b3-4b01-4bcb-a6a9-e5a88836d46e
7817fb5f-6bf6-461c-98e3-0db4a00df9e0	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	90a387f4-deca-4cc4-addb-ad02323f4084	bb0ec843-3988-4025-80c7-42da08bf647f	10	2	2026-08-21 14:13:07.167581+00	2026-08-21 14:13:13.739093+00	06c2f300-7e95-4ba3-baa4-edf438115a5d
968f4b39-48f2-49df-86ed-84eed0f4e204	aacea673-e33b-4e03-9a1d-a59c899ac662	cf7dd5b8-fe99-4279-8552-ed772da25b43	6810ebca-5c7e-4189-8418-a8b6b81096cb	10	2	2026-08-21 14:13:54.684401+00	2026-08-21 14:14:02.242829+00	6b083dfa-4c1a-4348-a10b-09b75402800a
3ec1a196-377a-430d-b222-f5d6a4b962bb	db8af7ab-c951-44ff-8445-0f2a4bad9b65	ab6152c8-7827-4b63-8ea4-7ef4218b514f	95b682f1-307f-4142-b413-5e988f415a3f	7	0	2026-08-21 23:06:27.645501+00	2026-08-21 23:06:27.645501+00	f2eda4f3-fc5d-4c74-80b3-092403c42d09
3446d40c-a236-48d1-9755-2bc3a1625681	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	10	4	2026-08-21 23:06:25.533148+00	2026-08-21 23:06:27.676303+00	f2eda4f3-fc5d-4c74-80b3-092403c42d09
2f70287d-00f3-4f09-9007-9b57528d90b1	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	40779f44-3065-4b9b-8b1a-c03db851d96d	35	0	2026-08-21 23:08:34.899994+00	2026-08-21 23:08:35.593533+00	237d1093-81ce-4d31-bbf7-72a9420b9303
bb6aaddc-67a1-4d08-8e3a-264a9a797fdf	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	5	0	2026-08-21 23:08:36.091852+00	2026-08-21 23:08:36.091852+00	ce9defdc-cf4f-4d1a-95a4-a6ed8d4d5fdb
75f04dc2-59c3-461c-9873-087639d04eb1	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	3	0	2026-08-21 23:08:36.106792+00	2026-08-21 23:08:36.106792+00	36e87102-9405-4de7-b836-eeed5483b5b7
e6f93919-5065-44fb-9a96-91d82c69542f	4c266dc8-d833-48bf-831f-fdf5b3e089b6	499fbc66-186d-45a2-bf27-2122e20c7947	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	7	0	2026-08-21 23:08:38.26658+00	2026-08-21 23:08:38.26658+00	cd5234b0-21f9-4541-82e3-af6b44d2a3f7
6f61b6e9-8e60-416f-b4b6-93fd4003db49	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	10	4	2026-08-21 23:08:36.075511+00	2026-08-21 23:08:38.301894+00	cd5234b0-21f9-4541-82e3-af6b44d2a3f7
75246fd1-265f-4d3f-9647-440f5ad69507	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	d2353df5-96fa-4636-a01d-d7503b30b9d3	20	0	2026-08-22 00:18:09.535518+00	2026-08-22 00:18:09.535518+00	52aa22d4-ef94-4d95-921d-643517c28407
8f263a4c-4340-468d-b384-d1a9441ad227	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	10	0	2026-08-22 00:18:09.604124+00	2026-08-22 00:18:09.604124+00	af48f61a-fb4a-424a-b1df-daf72792421c
51ad61cb-3c3d-4491-a98f-8364e0095b50	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	6	0	2026-08-22 00:42:57.209689+00	2026-08-22 00:42:57.209689+00	8404132a-f171-4131-b3a7-829ad21c15ff
1c84ec86-7bd3-4e7b-9562-e76e75012dfe	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	4	0	2026-08-22 00:42:57.224086+00	2026-08-22 00:42:57.224086+00	20dc2c86-3e17-4949-a3d2-152be599b766
f5456700-24be-403b-8cfe-f6617e329864	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	6	0	2026-08-22 00:45:15.853652+00	2026-08-22 00:45:15.853652+00	a7a086ec-b66e-4452-a34e-972df4fcafa1
d855b88b-bcf5-4880-88a4-fdd0699ce1cf	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	4	0	2026-08-22 00:45:15.868958+00	2026-08-22 00:45:15.868958+00	1c019546-3a02-4560-9027-7fab989def23
67372f09-c9cb-428d-ae92-558b6fbb6959	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	11bae456-e460-4c61-9f3d-81cf8fec8387	7	0	2026-08-22 01:03:42.574213+00	2026-08-22 01:03:42.574213+00	474f23b5-d9a8-4bde-8e9d-11b7e5159236
aacefc8c-ad92-400f-8650-8d9b65e1bff2	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	0597d6c0-7d34-40ad-b06e-cb917a6eff76	6	0	2026-08-22 01:11:14.020883+00	2026-08-22 01:11:14.020883+00	87e34596-a510-4615-82d4-27b244c804ca
b4554d00-2d71-4401-a194-22edfd1c407c	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	0597d6c0-7d34-40ad-b06e-cb917a6eff76	4	0	2026-08-22 01:11:14.065106+00	2026-08-22 01:11:14.065106+00	dd7cea02-4980-4d0e-ae08-3715b2c4f7a7
a9546c05-dc2b-4fe2-a509-38bf80d467c4	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	02b5836e-dbe7-4089-b2ff-f5c2210581f2	0	0	2026-08-22 01:19:20.076842+00	2026-08-22 01:22:19.567186+00	e8cb2574-2c41-42b8-83e2-6e28ce6682e4
1413fbea-edab-42da-bcf8-cead82ecfa6f	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	bf84c071-3b23-476b-aaa1-e517f76f583a	0	0	2026-08-22 01:23:12.938025+00	2026-08-22 01:23:12.938025+00	6966ff43-eacb-446d-9397-0a48c8d9df87
e24bc83c-c16a-4d29-bf66-0a1ae7cdc0d6	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	6	0	2026-08-22 01:23:37.603788+00	2026-08-22 01:23:37.603788+00	54f0758d-5169-455e-84f2-5beae07199e3
99797b97-80df-40da-8618-37920110daf7	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	4	0	2026-08-22 01:23:37.652542+00	2026-08-22 01:23:37.652542+00	fb0a5c01-2aee-4364-9e78-56d445d4993f
4fdb86ce-d435-4e3a-a0b6-36ceac346fa7	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	51adcf0d-f636-4da2-8045-bf303f76ed0b	6	0	2026-08-22 01:30:30.541711+00	2026-08-22 01:30:30.541711+00	61fcd4a0-2e23-4ed3-a803-02a212b9c409
166030b8-202e-4794-add9-2f16b3790fa8	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	51adcf0d-f636-4da2-8045-bf303f76ed0b	4	0	2026-08-22 01:30:30.579638+00	2026-08-22 01:30:30.579638+00	6d207968-a153-4214-9312-a433410c8493
81c0f1f4-753c-4764-a5c8-ce82ca42e2e5	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	643f0184-bebd-4cd2-bdcf-23505d17b5d7	0	0	2026-08-22 01:30:46.642486+00	2026-08-22 01:30:46.642486+00	445630d9-ab21-468f-be18-1e84dee2b63b
4b953478-5b76-474d-b1a0-fb7ccb2bbf6e	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	11111111-1111-1111-1111-111111111111	20	0	2026-08-24 12:26:49.616871+00	2026-08-24 12:26:49.616871+00	11111111-1111-1111-1111-111111111113
9771fb8f-3be8-4c5f-ac68-523ea219d91e	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	15	0	2026-08-26 15:21:26.78404+00	2026-08-26 15:21:26.78404+00	4b853476-365c-48de-a269-e6a739b5b827
67c24568-5ed0-4f89-b3c8-4c2ef6d4b4f3	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	11111111-1111-1111-1111-111111111111	25	1	2026-08-24 12:26:49.616871+00	2026-08-25 07:42:24.289738+00	11111111-1111-1111-1111-111111111112
86c59b77-8e0d-43b0-ae4a-95800ff83e5a	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	0	0	2026-08-25 08:09:30.93264+00	2026-08-25 08:09:30.93264+00	bc436e11-3196-439b-8e5d-8e1a3c0a2f4a
1b1b66fc-84ae-488b-bfcf-3dedb12396ed	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	0	0	2026-08-25 08:09:30.953039+00	2026-08-25 08:09:30.953039+00	15d87612-9934-431c-87c5-d961fc4177a8
cce46124-ac7f-4bc3-a0d0-c78723f72dd9	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	0	0	2026-08-25 08:09:30.953654+00	2026-08-25 08:09:30.953654+00	67ac0e2d-2807-4e36-b628-5bb80171a4a0
cdff1d38-7674-4640-9437-7567c683e286	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	10	0	2026-08-26 15:21:26.802507+00	2026-08-26 15:21:26.802507+00	8ba6ce5f-a036-4bb1-be28-0fd14be45fc1
99498323-6395-409b-a593-6eec159082bb	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	12	0	2026-08-26 15:21:26.820364+00	2026-08-26 15:21:26.820364+00	96130975-fcfe-49cc-9dce-97fa8b7cb543
0c092cdb-6839-4986-925e-e42c6186fc3f	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	240989cd-66f6-45bd-ac81-62ea6ac175e4	0	0	2026-08-24 13:33:25.230189+00	2026-08-26 11:06:38.876203+00	c62fcde1-ff3b-4424-a621-5f509bae0163
ae66c1fb-d86b-4e97-97c3-9f06cb2cb61f	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	2dec452a-7c11-4412-97e5-ad733e3bb0ff	34	0	2026-08-25 11:53:32.309319+00	2026-08-26 11:21:54.348688+00	346c2ac5-3291-4360-a240-f0b198c200a0
489857b9-4546-4c03-bd3d-016ac93d1f74	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	5	0	2026-08-26 15:21:26.920239+00	2026-08-26 15:21:26.920239+00	7021f3c7-e63c-4025-b499-4b7ee572dd10
528d7c57-0772-46be-b33a-31e69ed7180b	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	422180d1-4773-441d-90db-f989ea1df09b	25bb1f32-b839-4350-ac1e-05f15bb9fadb	10	2	2026-08-26 13:19:07.20876+00	2026-08-26 13:19:11.154392+00	0d912723-82ba-424f-825c-d89cc055eff5
6328680a-056e-4697-a04c-c13801ba003a	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	3	0	2026-08-26 15:21:26.940044+00	2026-08-26 15:21:26.940044+00	9bf786be-b399-4d16-83b5-bfb922e62f0b
0682e51d-f89c-4f1d-9a60-9380483592fd	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	4	0	2026-08-26 15:21:26.957259+00	2026-08-26 15:21:26.957259+00	6f7e2460-bcc3-48b8-b929-79dda417dcd8
fba25e71-d8df-4a4f-8c4f-f6ed6066db91	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	2	0	2026-08-26 15:21:26.993157+00	2026-08-26 15:21:26.993157+00	74138177-d61b-4931-a987-38d6053c2b5a
f9856a83-cc4f-4982-9160-ac54cf0bfd5a	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	3633db86-a845-4652-a3a2-479204e9df3d	8	0	2026-08-26 13:26:41.094256+00	2026-08-26 13:26:45.229925+00	2edd16d1-d166-4042-869c-dc69c5ab0fee
8cc9ecbe-7acb-4a5f-bda0-79b0e6fdffc5	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	3a758e49-51c7-4051-abd8-35f6d97d1137	12	0	2026-08-26 15:21:27.092993+00	2026-08-26 15:21:27.092993+00	91c2ed6b-ad4d-47fd-b750-04b50c9ce3a8
b78c783a-4c29-48c5-96a4-32214931139e	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	a783edfa-22cc-415b-8a83-487edb568366	5	0	2026-08-26 15:21:27.265985+00	2026-08-26 15:21:27.265985+00	08f5d1ea-2a72-4de8-8476-b3d49a0cd198
a44a068f-7193-4fbd-803a-33a748c6a915	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	1182341b-db96-45e6-8fae-ae5b86f7c5b0	8	0	2026-08-26 13:28:13.536209+00	2026-08-26 13:28:17.573079+00	8a34623a-177e-4ba9-8fda-e202569a2177
0900879c-22ac-42dd-a6cf-3f499cf2465b	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	4	0	2026-08-26 14:17:53.261601+00	2026-08-26 14:18:21.583152+00	d3edb42b-e3d9-4750-b851-2b2483673301
481af41c-f6be-4928-959a-540126ec7531	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	5	0	2026-08-26 14:19:31.310892+00	2026-08-26 14:19:31.310892+00	ff36085b-ac18-4b81-80d8-6d5711a251d8
758ec0c4-e156-430d-8837-45c5b26537fe	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	3	0	2026-08-26 14:20:01.40444+00	2026-08-26 14:20:01.40444+00	e917c3a7-323a-4ff2-a697-47e7b29c5ba9
0279db23-8e91-41c1-b6f7-039ae87e1ddb	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	10	0	2026-08-26 15:20:09.395287+00	2026-08-26 15:20:09.395287+00	d8485982-b5c1-41a8-b202-faea034099c3
89e5ce7e-5b8d-4d21-b735-cae5f927b44c	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	5	0	2026-08-26 15:20:09.417179+00	2026-08-26 15:20:09.417179+00	777d37dd-23bc-4150-b384-9c83261d0008
abac166b-2e27-4c5d-8885-dc7bf0fc2bdb	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	8	0	2026-08-26 15:20:09.429849+00	2026-08-26 15:20:09.429849+00	b1f8dbc3-0295-4332-8e7e-cf0d5f4e8e3b
4956e5ef-6012-4643-a965-9daa7d9a6208	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	3	0	2026-08-26 15:20:09.445955+00	2026-08-26 15:20:09.445955+00	5a971890-6510-40d5-8eab-fa165506b0bd
b2f08917-f8cd-4bc7-ac3c-5d604516f010	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	10	0	2026-08-26 15:20:09.63272+00	2026-08-26 15:20:09.63272+00	9536a714-88b2-44cc-9cd4-d6d91c17238a
0731f32e-c34b-4df7-996a-db00a3f4b4a3	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	5	0	2026-08-26 15:20:09.647888+00	2026-08-26 15:20:09.647888+00	681c287e-98ca-403a-9b97-3fd968e2b485
0620b331-df44-4c0f-9399-8aba4c13d816	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	8	0	2026-08-26 15:20:09.660941+00	2026-08-26 15:20:09.660941+00	c47d883a-c363-4056-bdd4-220797b73147
5b9d831d-a64b-459b-b433-0737f7d2cc60	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	20	0	2026-08-26 15:20:09.732951+00	2026-08-26 15:20:09.732951+00	6f4107cb-5d3a-4a9c-a110-87d35b8b75cf
41229efe-1b4a-4c30-a14c-a286b2d7e52c	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	15	0	2026-08-26 15:20:09.748681+00	2026-08-26 15:20:09.748681+00	c86c43ad-f134-4e88-8ca3-147750dda696
66a43acd-67ca-4a43-9977-0f7fc1eef649	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	10	0	2026-08-26 15:20:09.763612+00	2026-08-26 15:20:09.763612+00	9399d553-e713-47d2-8d7c-e1e963035493
dd6cd155-86f3-4b98-a43d-f449ee24eed8	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	12	0	2026-08-26 15:20:09.779382+00	2026-08-26 15:20:09.779382+00	52357a84-cd46-4ade-a543-8ef7f792308a
e4ebfd13-0b22-4d37-bf43-92e9d3d5cc16	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	3	0	2026-08-26 15:20:09.867582+00	2026-08-26 15:20:09.867582+00	25c3aae5-7236-4e17-940f-3bc55856026e
629773c4-b5e0-4bad-87ad-60b9b4aaba67	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	4	0	2026-08-26 15:20:09.882505+00	2026-08-26 15:20:09.882505+00	804ba596-ce23-4623-8767-b63e6e1d5336
8226595d-1c77-4df1-bd46-08dd4c89520a	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	2	0	2026-08-26 15:20:09.901705+00	2026-08-26 15:20:09.901705+00	d77217fa-d737-41df-920c-7a8349b32750
67fa04fa-7adc-49f2-b745-3e4fa6baea81	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	950ad450-2f4f-4661-ba0d-d40cb7f57ae0	12	0	2026-08-26 15:20:09.968002+00	2026-08-26 15:20:09.968002+00	41f06336-be5b-489c-a0e3-d900d556ec9b
b4a114b3-2788-42b3-a3ea-0c18140ef390	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	038981eb-f126-4009-a431-7a53744ecc07	5	0	2026-08-26 15:20:10.033946+00	2026-08-26 15:20:10.033946+00	429e9c2a-177b-4806-b6df-919cbe3e71ed
26247bb1-45ab-4c65-b96d-22c4506aa848	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	10	0	2026-08-26 15:21:26.336986+00	2026-08-26 15:21:26.336986+00	8c381b27-8a7e-445a-a6ea-8b425cd00952
5a28dd3e-ebe9-476b-9c8d-7d3a0d3219dc	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	5	0	2026-08-26 15:21:26.354614+00	2026-08-26 15:21:26.354614+00	cd142b02-85b2-4368-8e3b-8f64e94214d1
10b66a53-ff93-49f0-85a7-3327a21c6f55	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	8	0	2026-08-26 15:21:26.370591+00	2026-08-26 15:21:26.370591+00	61c2f24b-3d22-4c1e-86ee-6df609e7f8fe
fd293d64-f5c0-4f00-9b3c-194e4531f336	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	3	0	2026-08-26 15:21:26.423172+00	2026-08-26 15:21:26.423172+00	7ceff9bf-8559-4caf-a3fc-473ff25bd585
2cc7f196-42e2-4305-b6bd-200f7f8fa28f	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	10	0	2026-08-26 15:21:26.658733+00	2026-08-26 15:21:26.658733+00	17b9bb08-1fda-4d51-9740-7bc6020dfe83
c38ffbf5-f6cc-455c-b8ce-268f49716ca3	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	5	0	2026-08-26 15:21:26.676438+00	2026-08-26 15:21:26.676438+00	52644af3-8fd7-4954-8073-3e2f40d1b920
22e43ffd-180b-429e-8a4b-5042a3d8a1eb	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	8	0	2026-08-26 15:21:26.695834+00	2026-08-26 15:21:26.695834+00	0d8957e4-b643-4413-89e9-6d99e5772d7a
08c8e25b-5350-4663-ada0-0816ac80c9bc	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	20	0	2026-08-26 15:21:26.766432+00	2026-08-26 15:21:26.766432+00	4735b867-63af-498f-a4e9-03a83354c007
c9c96970-edab-43d4-9f73-1455e066a197	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	5	0	2026-08-26 16:23:43.156194+00	2026-08-26 16:23:43.156194+00	53c0988a-3d96-453b-9546-69f83e16a29f
bbe790b1-19e1-43bc-9771-a00ef0313fc7	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	8	0	2026-08-26 16:23:43.165001+00	2026-08-26 16:23:43.165001+00	f292323e-9317-48e1-b4a4-26fbc3761b61
ef8fea6e-1eab-4e85-8726-2ba142710b70	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	3	0	2026-08-26 16:23:43.175353+00	2026-08-26 16:23:43.175353+00	7a0796a7-424c-433c-a652-72316a0490f8
582e895c-a8ce-40cc-8242-7a031a483631	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	8	0	2026-08-26 16:23:43.12289+00	2026-08-26 18:35:10.632672+00	11145bb0-ede0-4981-b683-a8def97c26ef
7eacb7cf-3aba-48cc-a2dc-a876180ad221	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	5	2	2026-08-26 15:20:09.851475+00	2026-08-26 19:12:00.11259+00	092005dc-8623-4e9e-9047-ca6e828ed017
\.


--
-- Data for Name: level_benefits; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.level_benefits (id, level_type, level_name, benefit_type, benefit_value, status, created_at) FROM stdin;
18ca6441-ee71-47c0-b6a7-37983cf5a1a9	SELLER	STARTER	SEARCH_BOOST	0.00	ACTIVE	2026-08-16 07:37:23.860214
caf90bba-1367-458d-bde8-4fea11a854b6	SELLER	STARTER	RECOMMENDATION_ELIGIBILITY	0.00	ACTIVE	2026-08-16 07:37:23.860214
385531d8-e13b-4f56-8992-bc2cf4c33478	SELLER	STARTER	HIGH_VALUE_BUYER_ACCESS	0.00	ACTIVE	2026-08-16 07:37:23.860214
75e09129-8daf-47d4-b0c5-37312679d55c	SELLER	ACTIVE	SEARCH_BOOST	0.10	ACTIVE	2026-08-16 07:37:23.860214
abde236e-9f6c-400c-bdbf-3251ca63911b	SELLER	ACTIVE	RECOMMENDATION_ELIGIBILITY	0.00	ACTIVE	2026-08-16 07:37:23.860214
65ab26af-0bde-4c14-9a61-fd76a1e3629e	SELLER	ACTIVE	HIGH_VALUE_BUYER_ACCESS	0.00	ACTIVE	2026-08-16 07:37:23.860214
9c26ce5c-2726-40c0-8d47-be7934a629dd	SELLER	PRO	SEARCH_BOOST	0.25	ACTIVE	2026-08-16 07:37:23.860214
4bc02cc0-68cd-4073-b547-61c48b2bb48f	SELLER	PRO	RECOMMENDATION_ELIGIBILITY	1.00	ACTIVE	2026-08-16 07:37:23.860214
e7f0e773-b811-42d4-87d3-9cacb6bac4cc	SELLER	PRO	HIGH_VALUE_BUYER_ACCESS	0.00	ACTIVE	2026-08-16 07:37:23.860214
542edd0b-fc6c-49b7-9071-37b9e7d060f5	SELLER	ELITE	SEARCH_BOOST	0.50	ACTIVE	2026-08-16 07:37:23.860214
132fefed-ac5d-48d0-9b21-9c5abdb3b193	SELLER	ELITE	RECOMMENDATION_ELIGIBILITY	1.00	ACTIVE	2026-08-16 07:37:23.860214
be57dbcd-868d-4b8e-91fe-54e779ce4ed0	SELLER	ELITE	HIGH_VALUE_BUYER_ACCESS	0.00	ACTIVE	2026-08-16 07:37:23.860214
e02b67da-1d1a-486e-812e-8d98e7c4afc2	SELLER	PREMIUM	SEARCH_BOOST	1.00	ACTIVE	2026-08-16 07:37:23.860214
bda6cc38-d39e-4c9a-a0c9-11831f030fb3	SELLER	PREMIUM	RECOMMENDATION_ELIGIBILITY	1.00	ACTIVE	2026-08-16 07:37:23.860214
1fb3be6b-c2ab-4ac9-be6d-ad715c90ea43	SELLER	PREMIUM	HIGH_VALUE_BUYER_ACCESS	1.00	ACTIVE	2026-08-16 07:37:23.860214
3885cb7b-b2a9-41fd-85b8-1c8c8096b9ad	BUYER	BRONZE	PRICE_DISCOUNT_PERCENT	0.00	ACTIVE	2026-08-18 13:56:28.564954
f70549d1-8b04-4452-8522-dab5726641d0	BUYER	BRONZE	DELIVERY_DISCOUNT_PERCENT	0.00	ACTIVE	2026-08-18 13:56:28.564954
f381ecfd-3aff-4097-b7e4-4871f7fb9b59	BUYER	BRONZE	FREE_DELIVERY	0.00	ACTIVE	2026-08-18 13:56:28.564954
ce5bf527-f7ae-4011-ae8d-49f5b0803472	BUYER	SILVER	PRICE_DISCOUNT_PERCENT	1.00	ACTIVE	2026-08-18 13:56:28.564954
87ecac8a-033c-401d-b5a2-36c77d4dd231	BUYER	SILVER	DELIVERY_DISCOUNT_PERCENT	0.00	ACTIVE	2026-08-18 13:56:28.564954
c9541731-e737-45a9-8418-557fe548ed5e	BUYER	SILVER	FREE_DELIVERY	0.00	ACTIVE	2026-08-18 13:56:28.564954
453e64ff-2107-41a3-9e42-45869e62aeb1	BUYER	GOLD	PRICE_DISCOUNT_PERCENT	3.00	ACTIVE	2026-08-18 13:56:28.564954
ff5610f6-3229-40ce-bbc8-fcc60ffef9ff	BUYER	GOLD	DELIVERY_DISCOUNT_PERCENT	0.00	ACTIVE	2026-08-18 13:56:28.564954
b8a47d23-0480-4861-9051-909deab096e4	BUYER	GOLD	FREE_DELIVERY	0.00	ACTIVE	2026-08-18 13:56:28.564954
a277c322-54f5-4b75-9984-2f2ffd62ecf8	BUYER	PLATINUM	PRICE_DISCOUNT_PERCENT	5.00	ACTIVE	2026-08-18 13:56:28.564954
1ebe211a-b4fd-4934-b172-1374720af632	BUYER	PLATINUM	DELIVERY_DISCOUNT_PERCENT	2.00	ACTIVE	2026-08-18 13:56:28.564954
1115e709-d80d-4cab-a719-36b264fbe35a	BUYER	PLATINUM	FREE_DELIVERY	0.00	ACTIVE	2026-08-18 13:56:28.564954
38235f1b-b0a8-4981-9c56-77733c971acb	BUYER	DIAMOND	PRICE_DISCOUNT_PERCENT	7.00	ACTIVE	2026-08-18 13:56:28.564954
2374a4f1-6903-4171-9f1e-643834336b36	BUYER	DIAMOND	DELIVERY_DISCOUNT_PERCENT	5.00	ACTIVE	2026-08-18 13:56:28.564954
4c1f0067-6046-4ce1-bfe2-e1d27a872a59	BUYER	DIAMOND	FREE_DELIVERY	1.00	ACTIVE	2026-08-18 13:56:28.564954
\.


--
-- Data for Name: order_lines; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.order_lines (id, order_id, product_id, variant_id, quantity, unit_price, created_at, base_unit_price, points_discount_per_unit, final_unit_price) FROM stdin;
c5af9afd-7930-44f8-966a-2ac5c99f5340	39f14eb2-a16b-44fe-a546-2701fee2b128	cb69da3a-bef2-44aa-84c3-636df0200d81	fec4d682-103b-41e8-90cc-ec40edd3e599	1	15000.00	2026-08-21 03:53:51.130408+00	0.00	0.00	0.00
885e3e62-5d60-4d4a-a3d2-6c19aa904dce	89b0f950-c5fe-4059-b23d-987a88eeddaa	cb69da3a-bef2-44aa-84c3-636df0200d81	fec4d682-103b-41e8-90cc-ec40edd3e599	1	15000.00	2026-08-21 03:53:55.532832+00	15000.00	0.00	15000.00
f2783a18-d244-421c-9ce7-971507a439d7	0bd192ee-550f-477c-bdd5-ba890b037d48	a92c35f3-5520-4269-b178-bc9cf568ba25	693e071f-962d-482e-92b0-872d35d1586c	1	15000.00	2026-08-21 04:16:10.487257+00	0.00	0.00	0.00
94d29686-fbcc-4208-b496-cee23187fcd2	8ec221fe-1463-45a3-82a7-9c8bd645326b	a92c35f3-5520-4269-b178-bc9cf568ba25	693e071f-962d-482e-92b0-872d35d1586c	1	15000.00	2026-08-21 04:16:14.122368+00	15000.00	0.00	15000.00
9a00ebb7-dce2-481c-af27-329d5dc455b8	1600dcc8-82ea-42de-8e69-7f3ce544c3e0	c88211fc-ff19-4b63-aac0-378b6006accd	6581e9b3-4b01-4bcb-a6a9-e5a88836d46e	2	50.00	2026-08-21 14:10:33.170376+00	50.00	0.00	50.00
43fbc805-b39b-4a3a-965a-b583ce9777ff	fd516e28-ff54-480c-9346-4c8788a4a9ef	bb0ec843-3988-4025-80c7-42da08bf647f	06c2f300-7e95-4ba3-baa4-edf438115a5d	2	50.00	2026-08-21 14:13:13.739093+00	50.00	0.00	50.00
f163246e-d4b8-457c-b34c-9ccb69c2b0ed	91de8819-2b33-45cc-b7c3-436b4d95492d	6810ebca-5c7e-4189-8418-a8b6b81096cb	6b083dfa-4c1a-4348-a10b-09b75402800a	2	50.00	2026-08-21 14:14:02.242829+00	50.00	0.00	50.00
619d9fd3-a455-45a8-9f33-9da2abb797e8	94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	a3de5bac-a9e5-4477-b8a2-401cf10aaca5	ce60c606-4b61-4229-90b3-edee744e95d1	2	50.00	2026-08-21 14:27:56.186495+00	50.00	0.00	50.00
3e8ea35e-4faa-4d89-9ae9-4fa4312d5266	3ea4bc31-a059-45dd-b5f8-50acfc088da1	65b6df58-93f5-434c-85c9-97eda93bcc2c	d0d5a904-a30c-431b-b1fd-03a2a532fa2f	2	50.00	2026-08-21 14:29:06.563046+00	50.00	0.00	50.00
9aa8efab-5c17-4eb3-ace0-9cd1f81640a5	bf550b83-e695-41f1-8545-795dac015ff9	11111111-1111-1111-1111-111111111111	11111111-1111-1111-1111-111111111112	1	180000.00	2026-08-25 07:42:24.289738+00	180000.00	0.00	180000.00
5932e6fc-fecf-40f8-8ccd-8d0bfc431e75	e916a98d-8162-47e1-9193-e08db1f3ac47	a92c35f3-5520-4269-b178-bc9cf568ba25	693e071f-962d-482e-92b0-872d35d1586c	1	15000.00	2026-08-25 08:01:24.399114+00	15000.00	0.00	15000.00
84134ea8-8a29-4f86-912d-a2387e6081af	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	a92c35f3-5520-4269-b178-bc9cf568ba25	693e071f-962d-482e-92b0-872d35d1586c	1	15000.00	2026-08-25 08:01:46.850028+00	15000.00	0.00	15000.00
2f3b2492-068e-443a-be86-7711cfa67d43	9bfe4f32-bac3-4835-8db3-5b469e7d643c	240989cd-66f6-45bd-ac81-62ea6ac175e4	c62fcde1-ff3b-4424-a621-5f509bae0163	2	7800.00	2026-08-26 10:41:18.388444+00	7800.00	1500.00	6300.00
5be0084d-8fff-477a-bcd9-48fda304039d	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	25bb1f32-b839-4350-ac1e-05f15bb9fadb	0d912723-82ba-424f-825c-d89cc055eff5	1	50000.00	2026-08-26 13:19:07.288032+00	50000.00	0.00	50000.00
a26f56bf-847d-48bf-bf3b-a16df246ef7d	a8634d5f-39de-49b3-a8f4-3b395bd665c8	25bb1f32-b839-4350-ac1e-05f15bb9fadb	0d912723-82ba-424f-825c-d89cc055eff5	1	50000.00	2026-08-26 13:19:11.154392+00	50000.00	0.00	50000.00
304d9112-e27b-4726-8b1a-9637538b1bc3	ba31f915-0007-4151-9b8b-685c5f7d345f	3633db86-a845-4652-a3a2-479204e9df3d	2edd16d1-d166-4042-869c-dc69c5ab0fee	1	50000.00	2026-08-26 13:26:41.161828+00	50000.00	0.00	50000.00
abcf73b1-74f3-43f1-96ce-9a5a36097119	77f12fc6-8628-451a-aec5-594095c83891	3633db86-a845-4652-a3a2-479204e9df3d	2edd16d1-d166-4042-869c-dc69c5ab0fee	1	50000.00	2026-08-26 13:26:45.041926+00	50000.00	0.00	50000.00
52e0c57b-632c-4bd7-973b-fc0a5a33f3de	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	1182341b-db96-45e6-8fae-ae5b86f7c5b0	8a34623a-177e-4ba9-8fda-e202569a2177	1	50000.00	2026-08-26 13:28:13.592289+00	50000.00	0.00	50000.00
d4f7a4f7-b19d-4df9-a821-451adc68fbb9	739c79ab-9b9f-4d54-bc16-830e967f149a	1182341b-db96-45e6-8fae-ae5b86f7c5b0	8a34623a-177e-4ba9-8fda-e202569a2177	1	50000.00	2026-08-26 13:28:17.421+00	50000.00	0.00	50000.00
b3176e4a-134f-484a-b4a7-d200f9cba15e	93e8de5a-2b9b-4b98-b968-8a15369789eb	497354c6-1272-48fd-b975-587a23f204e4	11145bb0-ede0-4981-b683-a8def97c26ef	2	25000.00	2026-08-26 18:34:11.21271+00	25000.00	0.00	25000.00
b24c2f0c-673e-4f3a-ac80-dd81e9b67b3c	466ed24c-5a13-4ae9-9038-21f25cf32c65	50f14201-f49e-4211-b044-6c24f12eb48c	092005dc-8623-4e9e-9047-ca6e828ed017	2	800000.00	2026-08-26 19:12:00.11259+00	800000.00	0.00	800000.00
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.order_status_history (id, order_id, status, changed_by, notes, created_at) FROM stdin;
f416711b-6b52-4118-9ba0-3d4e495b9d8b	39f14eb2-a16b-44fe-a546-2701fee2b128	PENDING	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order created	2026-08-21 03:53:51.130408+00
9badcf13-1c82-4463-af59-7c0dbdfa7ace	39f14eb2-a16b-44fe-a546-2701fee2b128	ACCEPTED	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order accepted	2026-08-21 03:53:51.247633+00
a94c8788-1074-4ec2-bd68-22c8da55ab1f	39f14eb2-a16b-44fe-a546-2701fee2b128	PREPARING	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order being prepared	2026-08-21 03:53:51.296498+00
a3091a30-abba-48ee-ad2e-6bc577ecc4f5	39f14eb2-a16b-44fe-a546-2701fee2b128	COMPLETED	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order completed	2026-08-21 03:53:51.314912+00
f1ad2f39-6e47-4841-9afb-68e404750994	89b0f950-c5fe-4059-b23d-987a88eeddaa	PENDING	\N	Buyer order created	2026-08-21 03:53:55.532832+00
836fd5bd-ddd0-463a-b021-187924549acc	89b0f950-c5fe-4059-b23d-987a88eeddaa	ACCEPTED	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order accepted	2026-08-21 03:53:55.588582+00
be4d95c7-4243-4d72-99c4-dfd36f20927e	89b0f950-c5fe-4059-b23d-987a88eeddaa	PREPARING	4ad3d1d8-8224-48e3-a15f-efd114544a97	Order being prepared	2026-08-21 03:54:01.508823+00
3a465b00-0552-4563-a4f2-33cb4e7eac69	89b0f950-c5fe-4059-b23d-987a88eeddaa	READY_FOR_PICKUP	4ad3d1d8-8224-48e3-a15f-efd114544a97		2026-08-21 03:54:01.528804+00
5e1cc62e-2ec4-4885-98b6-6ab4c78088bf	89b0f950-c5fe-4059-b23d-987a88eeddaa	RECEIVED	9fbf0cc2-ae16-45fb-a3e0-7fc1db4b4bc7	Buyer confirmed received	2026-08-21 03:54:01.548993+00
2cc187b3-b2c2-45d0-92af-2ee22c769d50	89b0f950-c5fe-4059-b23d-987a88eeddaa	COMPLETED	\N	Auto-completed after buyer received	2026-08-21 03:54:01.560625+00
d997eedc-ba60-4d26-b1e9-10ce803b943a	0bd192ee-550f-477c-bdd5-ba890b037d48	PENDING	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order created	2026-08-21 04:16:10.487257+00
7d78e485-38e8-41cd-848f-dfc8f95c5461	0bd192ee-550f-477c-bdd5-ba890b037d48	ACCEPTED	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order accepted	2026-08-21 04:16:10.516077+00
4a085083-7506-43f0-afaf-8159a7589f00	0bd192ee-550f-477c-bdd5-ba890b037d48	PREPARING	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order being prepared	2026-08-21 04:16:10.54847+00
97caa10c-c796-4917-a0b3-15a9c430c3a5	0bd192ee-550f-477c-bdd5-ba890b037d48	COMPLETED	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order completed	2026-08-21 04:16:10.566662+00
5ccffc6f-1735-4d85-8508-ed6a3ec6c3fb	8ec221fe-1463-45a3-82a7-9c8bd645326b	PENDING	\N	Buyer order created	2026-08-21 04:16:14.122368+00
8531942f-002b-4c02-8c13-219d3e4b6f25	8ec221fe-1463-45a3-82a7-9c8bd645326b	ACCEPTED	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order accepted	2026-08-21 04:16:14.167208+00
fda33709-8818-4d38-bc3f-ce8a5852464b	8ec221fe-1463-45a3-82a7-9c8bd645326b	PREPARING	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order being prepared	2026-08-21 04:16:19.938968+00
323ea90b-0d5b-4019-b20e-435992c72dfe	8ec221fe-1463-45a3-82a7-9c8bd645326b	READY_FOR_PICKUP	00c2d92b-4a5a-4000-b15b-a888d217f4c9		2026-08-21 04:16:19.954445+00
86fdc883-16bf-4ac8-8b24-8338a7102c82	8ec221fe-1463-45a3-82a7-9c8bd645326b	RECEIVED	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	Buyer confirmed received	2026-08-21 04:16:19.967523+00
1cce6ec6-37b0-4cdb-940f-d0bb702f8094	8ec221fe-1463-45a3-82a7-9c8bd645326b	COMPLETED	\N	Auto-completed after buyer received	2026-08-21 04:16:19.972508+00
9fa15ee5-37d2-4028-a76c-0f3db22b6ffd	1600dcc8-82ea-42de-8e69-7f3ce544c3e0	PENDING	\N	Buyer order created	2026-08-21 14:10:33.170376+00
da96c8de-4563-45e4-bd34-eb1b9e46b93a	fd516e28-ff54-480c-9346-4c8788a4a9ef	PENDING	\N	Buyer order created	2026-08-21 14:13:13.739093+00
cf4ada1d-3d57-45a5-931d-4c8d12426ac5	fd516e28-ff54-480c-9346-4c8788a4a9ef	ACCEPTED	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	Order accepted	2026-08-21 14:13:13.771266+00
c2ae5a3c-b15d-4c5e-af29-dc2a9c6febfd	fd516e28-ff54-480c-9346-4c8788a4a9ef	PREPARING	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	Order being prepared	2026-08-21 14:13:13.780071+00
a107380e-1151-4e40-8398-172d32c372c0	91de8819-2b33-45cc-b7c3-436b4d95492d	PENDING	\N	Buyer order created	2026-08-21 14:14:02.242829+00
98f5b60f-aafe-42cd-a057-8ab2fb3ef004	91de8819-2b33-45cc-b7c3-436b4d95492d	ACCEPTED	d31867cb-cc3e-49c6-ba4c-04d10901255b	Order accepted	2026-08-21 14:14:02.273206+00
40c317d0-a047-4e41-92ea-9af99bb0ab5d	91de8819-2b33-45cc-b7c3-436b4d95492d	PREPARING	d31867cb-cc3e-49c6-ba4c-04d10901255b	Order being prepared	2026-08-21 14:14:02.281738+00
b67856e0-f2c1-471f-9ca0-975fb1089319	94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	PENDING	\N	Buyer order created	2026-08-21 14:27:56.186495+00
dfdf37c2-dd85-4c06-982c-9f6486072ad2	94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	ACCEPTED	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	Order accepted	2026-08-21 14:27:56.258013+00
df4302ed-9c77-4945-8357-e1086b8012c8	94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	PREPARING	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	Order being prepared	2026-08-21 14:27:56.267878+00
9904a524-72da-4120-b9f7-15441342ba00	94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	READY	ac0622f2-f999-4bad-8a3c-fb8b97304ff3		2026-08-21 14:27:56.276121+00
956bca67-9401-4641-a9e4-ca3fe208ed53	3ea4bc31-a059-45dd-b5f8-50acfc088da1	PENDING	\N	Buyer order created	2026-08-21 14:29:06.563046+00
3490ef30-09e7-4162-b4c3-803ef88fcf9a	3ea4bc31-a059-45dd-b5f8-50acfc088da1	ACCEPTED	53eabe9b-cf41-4444-a608-b08e85779c01	Order accepted	2026-08-21 14:29:06.588927+00
84a64679-cc58-4e3a-a534-cca9f584719b	3ea4bc31-a059-45dd-b5f8-50acfc088da1	PREPARING	53eabe9b-cf41-4444-a608-b08e85779c01	Order being prepared	2026-08-21 14:29:06.598357+00
5821e602-55ce-4117-af5f-fbcc10d9431c	3ea4bc31-a059-45dd-b5f8-50acfc088da1	READY	53eabe9b-cf41-4444-a608-b08e85779c01		2026-08-21 14:29:06.607286+00
503e8313-7639-4f9e-9588-e78e4f809e61	bf550b83-e695-41f1-8545-795dac015ff9	PENDING	\N	Buyer order created	2026-08-25 07:42:24.289738+00
63497f9b-9061-4dde-a0d7-0542c90c78e0	e916a98d-8162-47e1-9193-e08db1f3ac47	PENDING	\N	Buyer order created	2026-08-25 08:01:24.399114+00
dd4463fd-7e51-4f0a-bbcb-3d7ae3f0618a	e916a98d-8162-47e1-9193-e08db1f3ac47	ACCEPTED	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order accepted	2026-08-25 08:01:24.507067+00
c00bdc15-47b1-4189-b77e-0a0c0086b057	e916a98d-8162-47e1-9193-e08db1f3ac47	PREPARING	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order being prepared	2026-08-25 08:01:24.56019+00
e4eefb07-2887-485a-a04c-0621ac994142	e916a98d-8162-47e1-9193-e08db1f3ac47	READY	00c2d92b-4a5a-4000-b15b-a888d217f4c9		2026-08-25 08:01:24.572757+00
e46f8373-4ade-4351-9a40-7e0b3fd04dcb	e916a98d-8162-47e1-9193-e08db1f3ac47	OUT_FOR_DELIVERY	00c2d92b-4a5a-4000-b15b-a888d217f4c9		2026-08-25 08:01:24.584153+00
286f6709-1b9d-4fd3-b093-8081ceee2127	e916a98d-8162-47e1-9193-e08db1f3ac47	DELIVERED	00c2d92b-4a5a-4000-b15b-a888d217f4c9		2026-08-25 08:01:24.593643+00
e857b95d-a50f-4b7f-be38-13668581d587	e916a98d-8162-47e1-9193-e08db1f3ac47	RECEIVED	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	Buyer confirmed received	2026-08-25 08:01:24.604471+00
f093dfb8-f46e-4c4a-aaff-cea949d9bf41	e916a98d-8162-47e1-9193-e08db1f3ac47	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-25 08:01:24.630313+00
de4801a2-be26-490f-af29-e78514fdda01	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	PENDING	\N	Buyer order created	2026-08-25 08:01:46.850028+00
932b7d92-6d3a-4deb-801a-e553e46bbf1b	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	ACCEPTED	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order accepted	2026-08-25 08:01:46.872877+00
8fe43246-b18b-4c78-986d-02e01b9ea875	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	PREPARING	00c2d92b-4a5a-4000-b15b-a888d217f4c9	Order being prepared	2026-08-25 08:01:46.926544+00
6b042637-1a77-4083-9ec8-3830455b30b6	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	READY_FOR_PICKUP	00c2d92b-4a5a-4000-b15b-a888d217f4c9		2026-08-25 08:01:46.937069+00
903c9723-4757-4f9c-ab24-a6ffd8c71f03	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	RECEIVED	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	Buyer confirmed received	2026-08-25 08:01:47.032103+00
be5360fd-9e7f-452d-9379-ec765a89ece8	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-25 08:01:47.03763+00
b362d3cf-cc4c-495c-8317-e922556c3b63	9bfe4f32-bac3-4835-8db3-5b469e7d643c	PENDING	\N	Buyer order created	2026-08-26 10:41:18.388444+00
70602e7f-e31b-45bf-bc54-8451eb15e5ae	9bfe4f32-bac3-4835-8db3-5b469e7d643c	ACCEPTED	10f488ae-e546-407e-ad82-96efb18466c6	Order accepted	2026-08-26 10:43:35.347669+00
4baa34a7-f840-49b9-bb6a-e901366248af	9bfe4f32-bac3-4835-8db3-5b469e7d643c	PREPARING	10f488ae-e546-407e-ad82-96efb18466c6	Order being prepared	2026-08-26 10:51:28.79013+00
33abe119-d9c4-44eb-b1fd-6987a3244539	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	PENDING	\N	Buyer order created	2026-08-26 13:19:07.288032+00
7a50f271-19ad-4893-867b-d84ba05beba2	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	ACCEPTED	2f4bb545-2f88-4326-a274-e12b0815656e	Order accepted	2026-08-26 13:19:07.56241+00
599c0aa3-8a82-43bb-9d9e-7dff075b9fbb	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	PREPARING	2f4bb545-2f88-4326-a274-e12b0815656e	Order being prepared	2026-08-26 13:19:07.649765+00
cf1283d1-c1c9-4b14-9add-151ec57008c9	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	READY_FOR_PICKUP	2f4bb545-2f88-4326-a274-e12b0815656e		2026-08-26 13:19:07.679528+00
2b36de28-af4e-48ed-80a7-c98a26f70d1d	ccc3de98-a94c-463a-a6a1-cfa1246e4f33	RECEIVED	d440befb-c451-4c38-95f1-ba5c057ca0d9	Buyer confirmed received	2026-08-26 13:19:08.023654+00
22ea6909-84c1-4051-b85a-6bad927dfdfa	a8634d5f-39de-49b3-a8f4-3b395bd665c8	PENDING	\N	Buyer order created	2026-08-26 13:19:11.154392+00
e9a9bd2a-e9f9-49b3-bd2b-2f87707f94ab	a8634d5f-39de-49b3-a8f4-3b395bd665c8	ACCEPTED	2f4bb545-2f88-4326-a274-e12b0815656e	Order accepted	2026-08-26 13:19:11.199723+00
f1d88409-c948-4402-81bb-b90e4b8e8014	a8634d5f-39de-49b3-a8f4-3b395bd665c8	PREPARING	2f4bb545-2f88-4326-a274-e12b0815656e	Order being prepared	2026-08-26 13:19:11.226842+00
d41e3412-0d47-4ddd-8848-198cd12e1892	a8634d5f-39de-49b3-a8f4-3b395bd665c8	READY	2f4bb545-2f88-4326-a274-e12b0815656e		2026-08-26 13:19:11.255678+00
ef0d87e1-07ae-40ff-be63-02f0a4a41a58	a8634d5f-39de-49b3-a8f4-3b395bd665c8	OUT_FOR_DELIVERY	2f4bb545-2f88-4326-a274-e12b0815656e		2026-08-26 13:19:11.282147+00
2836dbdf-9ec6-4298-89cd-4339c33dd5f1	a8634d5f-39de-49b3-a8f4-3b395bd665c8	DELIVERED	2f4bb545-2f88-4326-a274-e12b0815656e		2026-08-26 13:19:11.311403+00
b15a8c46-e0fb-4740-bbc5-2fe79bb26695	a8634d5f-39de-49b3-a8f4-3b395bd665c8	RECEIVED	d440befb-c451-4c38-95f1-ba5c057ca0d9	Buyer confirmed received	2026-08-26 13:19:13.350611+00
87eb7d1e-2916-44bb-b020-f02ff1211190	ba31f915-0007-4151-9b8b-685c5f7d345f	PENDING	\N	Buyer order created	2026-08-26 13:26:41.161828+00
73c97b77-1ab7-441a-b503-2b9d39d06a98	ba31f915-0007-4151-9b8b-685c5f7d345f	ACCEPTED	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	Order accepted	2026-08-26 13:26:41.401592+00
84914e34-bc34-4065-9027-c8b04db2cfe7	ba31f915-0007-4151-9b8b-685c5f7d345f	PREPARING	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	Order being prepared	2026-08-26 13:26:41.532683+00
740676b5-42e6-400e-bdd3-8e8d45de243c	ba31f915-0007-4151-9b8b-685c5f7d345f	READY_FOR_PICKUP	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18		2026-08-26 13:26:41.559349+00
5bc71b13-e02d-4d1b-847d-61a01dfab0c7	ba31f915-0007-4151-9b8b-685c5f7d345f	RECEIVED	5593d59e-3cc5-4da3-955d-80f2cbbca1fd	Buyer confirmed received	2026-08-26 13:26:41.876276+00
f574dd41-fa4d-4418-a5cf-5ff6d6b8d6ce	ba31f915-0007-4151-9b8b-685c5f7d345f	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-26 13:26:41.919417+00
2626e50b-9944-45c4-8968-361f1056b581	77f12fc6-8628-451a-aec5-594095c83891	PENDING	\N	Buyer order created	2026-08-26 13:26:45.041926+00
d6e3a62b-829f-415f-acda-4194ac047631	77f12fc6-8628-451a-aec5-594095c83891	ACCEPTED	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	Order accepted	2026-08-26 13:26:45.080934+00
9f20b227-8dc4-4585-bf3b-e9c433a9097d	77f12fc6-8628-451a-aec5-594095c83891	PREPARING	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	Order being prepared	2026-08-26 13:26:45.137545+00
fde187c0-d7f7-4b79-b7f3-f97eb7f85dd9	77f12fc6-8628-451a-aec5-594095c83891	READY	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18		2026-08-26 13:26:45.171527+00
b8160292-99b5-483b-b787-09b5be351af9	77f12fc6-8628-451a-aec5-594095c83891	OUT_FOR_DELIVERY	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18		2026-08-26 13:26:45.196166+00
5bc0d81a-d16e-471c-b221-536c82631fab	77f12fc6-8628-451a-aec5-594095c83891	DELIVERED	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18		2026-08-26 13:26:45.220841+00
bb92aac8-c2fc-4ca0-b4d6-b3399ad8dafa	77f12fc6-8628-451a-aec5-594095c83891	RECEIVED	5593d59e-3cc5-4da3-955d-80f2cbbca1fd	Buyer confirmed received	2026-08-26 13:26:45.243567+00
4fa702ac-be47-422b-86a7-c8adaa8c7a20	77f12fc6-8628-451a-aec5-594095c83891	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-26 13:26:45.248022+00
c2599452-dc8d-4db6-9594-fae4f12d4625	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	PENDING	\N	Buyer order created	2026-08-26 13:28:13.592289+00
9f95564f-02b6-4c82-91a5-0a8ec0cb49cd	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	ACCEPTED	df9edc86-2eac-40d6-a0b4-625385b387bc	Order accepted	2026-08-26 13:28:13.800212+00
cf5d0aa6-2037-4100-a81f-5ac4c4533f35	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	PREPARING	df9edc86-2eac-40d6-a0b4-625385b387bc	Order being prepared	2026-08-26 13:28:13.900224+00
a14dfc8a-5f9b-4157-a804-3900051ca30a	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	READY_FOR_PICKUP	df9edc86-2eac-40d6-a0b4-625385b387bc		2026-08-26 13:28:13.923829+00
c7511d5e-f669-4bc1-b982-d9ba1d14a678	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	RECEIVED	5384da9a-5b5b-4df0-9063-7cbb8cd163ff	Buyer confirmed received	2026-08-26 13:28:14.264364+00
9379a0d1-01b8-4379-8e26-bb58b94e747f	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-26 13:28:14.308967+00
2b9953a9-d9b5-4a5c-9081-e4064563bd24	739c79ab-9b9f-4d54-bc16-830e967f149a	PENDING	\N	Buyer order created	2026-08-26 13:28:17.421+00
2fbb4054-1344-414c-9f7d-0f162ce2502c	739c79ab-9b9f-4d54-bc16-830e967f149a	ACCEPTED	df9edc86-2eac-40d6-a0b4-625385b387bc	Order accepted	2026-08-26 13:28:17.467157+00
a5b1debc-8dbd-4a50-8384-91494140b803	739c79ab-9b9f-4d54-bc16-830e967f149a	PREPARING	df9edc86-2eac-40d6-a0b4-625385b387bc	Order being prepared	2026-08-26 13:28:17.536592+00
d31a19c0-a0c7-4926-b80b-ac293ed4fc25	739c79ab-9b9f-4d54-bc16-830e967f149a	READY	df9edc86-2eac-40d6-a0b4-625385b387bc		2026-08-26 13:28:17.568815+00
fe5979c1-80d5-4eaf-91ae-86eb26a2097b	739c79ab-9b9f-4d54-bc16-830e967f149a	OUT_FOR_DELIVERY	df9edc86-2eac-40d6-a0b4-625385b387bc		2026-08-26 13:28:17.599909+00
7fc06474-a855-4680-815b-018bf0ff8307	739c79ab-9b9f-4d54-bc16-830e967f149a	DELIVERED	df9edc86-2eac-40d6-a0b4-625385b387bc		2026-08-26 13:28:17.631741+00
2606ea04-ce99-4467-aa7a-bf52e9b8d864	739c79ab-9b9f-4d54-bc16-830e967f149a	RECEIVED	5384da9a-5b5b-4df0-9063-7cbb8cd163ff	Buyer confirmed received	2026-08-26 13:28:17.660538+00
6400f6ec-9772-4f2e-b757-b89dfd951829	739c79ab-9b9f-4d54-bc16-830e967f149a	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-26 13:28:17.663979+00
28493001-62ca-4d2c-8353-972869efe2bc	9bfe4f32-bac3-4835-8db3-5b469e7d643c	READY_FOR_PICKUP	10f488ae-e546-407e-ad82-96efb18466c6		2026-08-26 16:50:04.949002+00
1dd619e3-1397-459d-9eac-9c4b60e42aab	93e8de5a-2b9b-4b98-b968-8a15369789eb	PENDING	\N	Buyer order created	2026-08-26 18:34:11.21271+00
824cc925-c4ab-4bce-acf6-5c68c5025fcb	93e8de5a-2b9b-4b98-b968-8a15369789eb	ACCEPTED	8700aec8-b351-4e33-845e-8254918e00ad		2026-08-26 18:35:24.318905+00
23e45f29-4e59-4085-a6d6-ed6fd8f20506	93e8de5a-2b9b-4b98-b968-8a15369789eb	PREPARING	8700aec8-b351-4e33-845e-8254918e00ad		2026-08-26 18:35:24.531799+00
45b0287e-473b-4940-80c5-c39fe2802dde	93e8de5a-2b9b-4b98-b968-8a15369789eb	READY	8700aec8-b351-4e33-845e-8254918e00ad		2026-08-26 18:35:24.761614+00
54d86221-9b00-4cdd-9c82-35d7e008689c	93e8de5a-2b9b-4b98-b968-8a15369789eb	OUT_FOR_DELIVERY	8700aec8-b351-4e33-845e-8254918e00ad		2026-08-26 18:35:24.974672+00
2e65cbec-ad19-417e-9484-8d45bd396896	93e8de5a-2b9b-4b98-b968-8a15369789eb	DELIVERED	8700aec8-b351-4e33-845e-8254918e00ad		2026-08-26 18:35:25.190573+00
701bb38a-a980-4e63-8500-d43f1ffddc70	93e8de5a-2b9b-4b98-b968-8a15369789eb	RECEIVED	1bb14759-9967-4d6c-8a65-91e91731f726	Buyer confirmed received	2026-08-26 18:35:25.395135+00
1e744ea3-4516-4737-845d-1078ff6c2a3a	93e8de5a-2b9b-4b98-b968-8a15369789eb	COMPLETED	\N	Auto-completed after receipt and payment verification	2026-08-26 18:35:25.400145+00
539bf9c8-60c5-4d26-a4c3-3a27300d147f	466ed24c-5a13-4ae9-9038-21f25cf32c65	PENDING	\N	Buyer order created	2026-08-26 19:12:00.11259+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.orders (id, business_id, shop_id, status, total_items, notes, created_by, created_at, updated_at, customer_id, buyer_profile_id, base_total, points_used, points_discount_amount, final_total, idempotency_key, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final, delivery_contact_name, delivery_phone, delivery_address, delivery_notes, points_finalized, order_number, accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at, inventory_claimed) FROM stdin;
9bfe4f32-bac3-4835-8db3-5b469e7d643c	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	READY_FOR_PICKUP	2		\N	2026-08-26 10:41:18.388444+00	2026-08-26 16:50:04.952223+00	\N	cfa4847c-bc06-4f1a-8791-c96d71b61579	15600.00	3	3000.00	12600.00	663859f3-93ae-4686-b66b-84daef6a304c	PICKUP	0.00	0	0.00	0.00	impoke johnson	9157905812			t	BTMI-1136	2026-08-26 10:43:35.351249+00	2026-08-26 10:51:28.798956+00	2026-08-26 16:50:04.952223+00	\N	\N	\N	\N	f
1600dcc8-82ea-42de-8e69-7f3ce544c3e0	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	c88305b5-74ca-4761-9775-a8aac15f29f4	PENDING	2		\N	2026-08-21 14:10:33.170376+00	2026-08-21 14:10:33.170376+00	\N	8ad7ceaa-1628-4cba-9944-a2614fa76f5a	100.00	0	0.00	100.00	\N		0.00	0	0.00	0.00					f	BTMI-1128	\N	\N	\N	\N	\N	\N	\N	f
39f14eb2-a16b-44fe-a546-2701fee2b128	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	COMPLETED	1	walk-in sale	4ad3d1d8-8224-48e3-a15f-efd114544a97	2026-08-21 03:53:51.130408+00	2026-08-21 03:53:51.326254+00	ae571fa4-9638-4437-9728-fd2a5319ad93	\N	0.00	0	0.00	0.00	\N		0.00	0	0.00	0.00					t	BTMI-1124	2026-08-21 03:53:51.257936+00	2026-08-21 03:53:51.299886+00	\N	\N	\N	\N	2026-08-21 03:53:51.326254+00	f
fd516e28-ff54-480c-9346-4c8788a4a9ef	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	90a387f4-deca-4cc4-addb-ad02323f4084	PREPARING	2		\N	2026-08-21 14:13:13.739093+00	2026-08-21 14:13:13.781643+00	\N	784d5a8f-9f29-421b-b035-2b13beefecdb	100.00	0	0.00	100.00	\N		0.00	0	0.00	0.00					f	BTMI-1129	2026-08-21 14:13:13.773466+00	2026-08-21 14:13:13.781643+00	\N	\N	\N	\N	\N	f
93e8de5a-2b9b-4b98-b968-8a15369789eb	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	COMPLETED	2		\N	2026-08-26 18:34:11.21271+00	2026-08-26 18:35:25.400685+00	\N	5fa6e0ec-098a-417d-856f-187eb5aeaa4b	50000.00	0	0.00	50000.00	0ab0764c-0c79-4568-809e-cfcb03d56295	SHOP_DELIVERY	5.00	0	0.00	5.00	Android Buyer	+243900111222	12 Av. Test, Gombe, Kinshasa	Sonner deux fois	t	BTMI-1143	2026-08-26 18:35:24.320646+00	2026-08-26 18:35:24.532227+00	2026-08-26 18:35:24.762207+00	2026-08-26 18:35:24.975271+00	2026-08-26 18:35:25.191121+00	2026-08-26 18:35:25.39582+00	2026-08-26 18:35:25.400685+00	t
466ed24c-5a13-4ae9-9038-21f25cf32c65	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	PENDING	2		\N	2026-08-26 19:12:00.11259+00	2026-08-26 19:12:00.11259+00	\N	361c8152-eadd-4fb2-8dd0-12054658f348	1600000.00	0	0.00	1600000.00	72cbe199-290e-4f14-91ce-b96e2ccf1d30		0.00	0	0.00	0.00					f	BTMI-1144	\N	\N	\N	\N	\N	\N	\N	f
89b0f950-c5fe-4059-b23d-987a88eeddaa	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	COMPLETED	1		\N	2026-08-21 03:53:55.532832+00	2026-08-21 03:54:01.561435+00	\N	4364cacd-338e-4bcf-ae7d-b8f21a857fb9	15000.00	0	0.00	15000.00	022ab5b0-34db-461c-8b90-a3badb8da94f	PICKUP	0.00	0	0.00	0.00	Buyer T	+243999000000	Test addr		t	BTMI-1125	2026-08-21 03:53:55.594044+00	2026-08-21 03:54:01.512944+00	2026-08-21 03:54:01.530324+00	\N	\N	2026-08-21 03:54:01.549789+00	2026-08-21 03:54:01.561435+00	f
0bd192ee-550f-477c-bdd5-ba890b037d48	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	COMPLETED	1	walk-in sale	00c2d92b-4a5a-4000-b15b-a888d217f4c9	2026-08-21 04:16:10.487257+00	2026-08-21 04:16:10.576687+00	62b66e54-598d-4e74-91de-a2cd365ebffd	\N	0.00	0	0.00	0.00	\N		0.00	0	0.00	0.00					t	BTMI-1126	2026-08-21 04:16:10.518006+00	2026-08-21 04:16:10.550674+00	\N	\N	\N	\N	2026-08-21 04:16:10.576687+00	f
91de8819-2b33-45cc-b7c3-436b4d95492d	aacea673-e33b-4e03-9a1d-a59c899ac662	cf7dd5b8-fe99-4279-8552-ed772da25b43	PREPARING	2		\N	2026-08-21 14:14:02.242829+00	2026-08-21 14:14:02.283696+00	\N	da0a8d9f-bbcd-4289-bb0d-5e7cad42b998	100.00	0	0.00	100.00	\N		0.00	0	0.00	0.00					f	BTMI-1130	2026-08-21 14:14:02.274981+00	2026-08-21 14:14:02.283696+00	\N	\N	\N	\N	\N	f
8ec221fe-1463-45a3-82a7-9c8bd645326b	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	COMPLETED	1		\N	2026-08-21 04:16:14.122368+00	2026-08-21 04:16:19.973261+00	\N	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	15000.00	0	0.00	15000.00	b5e4d3fa-868b-4510-9395-f9e2eb7fbda4	PICKUP	0.00	0	0.00	0.00	Buyer T	+243999000000	Test addr		t	BTMI-1127	2026-08-21 04:16:14.169785+00	2026-08-21 04:16:19.940856+00	2026-08-21 04:16:19.955238+00	\N	\N	2026-08-21 04:16:19.96825+00	2026-08-21 04:16:19.973261+00	f
94d4ee10-e89d-469b-8bf1-e0fc9e5279bc	704df200-1059-4f70-bfef-084c61675633	34c98649-b1f3-416f-a1d8-3e5c3094926f	READY	2		\N	2026-08-21 14:27:56.186495+00	2026-08-21 14:27:56.276746+00	\N	da41db1c-5d58-4662-a2dc-24ca29b14ec2	100.00	0	0.00	100.00	\N		0.00	0	0.00	0.00					f	BTMI-1131	2026-08-21 14:27:56.260881+00	2026-08-21 14:27:56.269684+00	2026-08-21 14:27:56.276746+00	\N	\N	\N	\N	f
3ea4bc31-a059-45dd-b5f8-50acfc088da1	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	57ccb6cb-92a9-4acc-ad5e-27ca5bfd96b8	READY	2		\N	2026-08-21 14:29:06.563046+00	2026-08-21 14:29:06.607746+00	\N	f091a1b0-7b3e-49fb-ac32-4a80925d11f3	100.00	0	0.00	100.00	\N		0.00	0	0.00	0.00					f	BTMI-1132	2026-08-21 14:29:06.59081+00	2026-08-21 14:29:06.600263+00	2026-08-21 14:29:06.607746+00	\N	\N	\N	\N	f
e916a98d-8162-47e1-9193-e08db1f3ac47	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	COMPLETED	1		\N	2026-08-25 08:01:24.399114+00	2026-08-25 08:01:25.619399+00	\N	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	15000.00	0	0.00	15000.00	3d01f511-c1c3-4e4d-8e10-4be84f06ce6d	SHOP_DELIVERY	2000.00	0	0.00	2000.00	Lifecycle Buyer	+243999000111	Gombe test address		t	BTMI-1134	2026-08-25 08:01:24.509696+00	2026-08-25 08:01:24.561897+00	2026-08-25 08:01:24.573321+00	2026-08-25 08:01:24.58553+00	2026-08-25 08:01:24.59408+00	2026-08-25 08:01:24.604917+00	2026-08-25 08:01:24.630703+00	f
bf550b83-e695-41f1-8545-795dac015ff9	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	PENDING	1		\N	2026-08-25 07:42:24.289738+00	2026-08-25 07:42:54.577593+00	\N	cfa4847c-bc06-4f1a-8791-c96d71b61579	180000.00	0	0.00	180000.00	329e9703-da1f-4bf2-ab02-6162fe572764	PICKUP	0.00	0	0.00	0.00	impoke johnson	9157905812			f	BTMI-1133	\N	\N	\N	\N	\N	\N	\N	f
ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	COMPLETED	1		\N	2026-08-25 08:01:46.850028+00	2026-08-25 08:01:47.279085+00	\N	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	15000.00	0	0.00	15000.00	035ef1ef-44d1-4552-be5a-7fbef756a5e8	PICKUP	0.00	0	0.00	0.00	Pickup Buyer	+243999000111			t	BTMI-1135	2026-08-25 08:01:46.875924+00	2026-08-25 08:01:46.92851+00	2026-08-25 08:01:46.937474+00	\N	\N	2026-08-25 08:01:47.032698+00	2026-08-25 08:01:47.038228+00	f
ccc3de98-a94c-463a-a6a1-cfa1246e4f33	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	422180d1-4773-441d-90db-f989ea1df09b	RECEIVED	1		\N	2026-08-26 13:19:07.288032+00	2026-08-26 13:19:08.02445+00	\N	58b991ef-ee6a-40d9-a95e-66f2cf4754b3	50000.00	0	0.00	50000.00	811a9207-2808-41b7-b97c-c7cd3a758fed	PICKUP	0.00	0	0.00	0.00	Sync Buyer	+243999000111	Test addr		f	BTMI-1137	2026-08-26 13:19:07.564633+00	2026-08-26 13:19:07.651504+00	2026-08-26 13:19:07.680094+00	\N	\N	2026-08-26 13:19:08.02445+00	\N	f
a8634d5f-39de-49b3-a8f4-3b395bd665c8	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	422180d1-4773-441d-90db-f989ea1df09b	RECEIVED	1		\N	2026-08-26 13:19:11.154392+00	2026-08-26 13:19:13.35156+00	\N	58b991ef-ee6a-40d9-a95e-66f2cf4754b3	50000.00	0	0.00	50000.00	b766d11d-f652-4be7-bea6-a870af5134f9	SHOP_DELIVERY	2000.00	0	0.00	2000.00	Sync Buyer	+243999000111	24 Av. Kalembelembe		f	BTMI-1138	2026-08-26 13:19:11.201418+00	2026-08-26 13:19:11.228276+00	2026-08-26 13:19:11.25628+00	2026-08-26 13:19:11.282658+00	2026-08-26 13:19:11.311876+00	2026-08-26 13:19:13.35156+00	\N	f
ba31f915-0007-4151-9b8b-685c5f7d345f	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	COMPLETED	1		\N	2026-08-26 13:26:41.161828+00	2026-08-26 13:26:42.496336+00	\N	fef7e933-b5da-4e4e-bd37-32157e61a0a0	50000.00	0	0.00	50000.00	18edcedb-20a8-4c9d-bcd6-1489b45c2def	PICKUP	0.00	0	0.00	0.00	Sync Buyer	+243999000111	Test addr		t	BTMI-1139	2026-08-26 13:26:41.406045+00	2026-08-26 13:26:41.534155+00	2026-08-26 13:26:41.559824+00	\N	\N	2026-08-26 13:26:41.877023+00	2026-08-26 13:26:41.919841+00	t
77f12fc6-8628-451a-aec5-594095c83891	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	COMPLETED	1		\N	2026-08-26 13:26:45.041926+00	2026-08-26 13:26:45.248478+00	\N	fef7e933-b5da-4e4e-bd37-32157e61a0a0	50000.00	0	0.00	50000.00	d238e262-eae5-4e8d-b310-0b271e47709f	SHOP_DELIVERY	2000.00	0	0.00	2000.00	Sync Buyer	+243999000111	24 Av. Kalembelembe		t	BTMI-1140	2026-08-26 13:26:45.082646+00	2026-08-26 13:26:45.139181+00	2026-08-26 13:26:45.172732+00	2026-08-26 13:26:45.196633+00	2026-08-26 13:26:45.221462+00	2026-08-26 13:26:45.24421+00	2026-08-26 13:26:45.248478+00	t
a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	COMPLETED	1		\N	2026-08-26 13:28:13.592289+00	2026-08-26 13:28:15.298491+00	\N	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	50000.00	0	0.00	50000.00	710c988e-5faa-4621-b7d6-f3f02085df28	PICKUP	0.00	0	0.00	0.00	Sync Buyer	+243999000111	Test addr		t	BTMI-1141	2026-08-26 13:28:13.803115+00	2026-08-26 13:28:13.901629+00	2026-08-26 13:28:13.924311+00	\N	\N	2026-08-26 13:28:14.264971+00	2026-08-26 13:28:14.309624+00	t
739c79ab-9b9f-4d54-bc16-830e967f149a	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	COMPLETED	1		\N	2026-08-26 13:28:17.421+00	2026-08-26 13:28:17.664404+00	\N	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	50000.00	0	0.00	50000.00	0b32090c-f2e7-4bbb-bc36-b49a0ab43f26	SHOP_DELIVERY	2000.00	0	0.00	2000.00	Sync Buyer	+243999000111	24 Av. Kalembelembe		t	BTMI-1142	2026-08-26 13:28:17.469001+00	2026-08-26 13:28:17.540042+00	2026-08-26 13:28:17.569378+00	2026-08-26 13:28:17.600556+00	2026-08-26 13:28:17.632814+00	2026-08-26 13:28:17.661007+00	2026-08-26 13:28:17.664404+00	t
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at) FROM stdin;
784b07b4-f221-496f-96df-994d226f6658	e271741f-799d-49b0-ac63-8e382d67fc6c	e00b384f1a5a2bd657a29ce41b6d7af5b13f258d286e9d1625ee370e7fdd7785	2026-08-26 10:26:17.102442+00	2026-08-26 11:26:17.10244+00	\N
cbb05e65-9134-48af-ab97-93325cc4a0a2	2b453813-5644-4fde-b134-d2bc067987a9	9533b8eb13e80ac53d958144afaa4027ab056f47217f076b3b44a64478594c01	2026-08-26 10:12:59.231554+00	2026-08-26 11:12:59.231552+00	2026-08-26 10:33:14.158429+00
b7db9f76-02dd-4391-8fc9-e69fb6d4eb24	2b453813-5644-4fde-b134-d2bc067987a9	603e09de24a6c670a3b437194d4e72c644cb30fef4f476287cfa8b1fb8860bde	2026-08-26 10:33:14.162629+00	2026-08-26 11:33:14.162628+00	2026-08-26 10:33:43.65195+00
\.


--
-- Data for Name: point_accounts; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.point_accounts (id, owner_type, owner_id, current_points, lifetime_points, level_id, status, created_at, updated_at, reserved_points) FROM stdin;
8a6657ab-585f-40e4-ba97-1e405778913e	BUYER	283b063b-2626-46b9-9639-db93c006cac5	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 00:04:07.086131	2026-08-21 00:04:07.711043	0
8658bab4-4ea9-47c4-a1a5-641cc1186aa9	SELLER_BUSINESS	e51fe249-0518-40e2-8435-68b871115957	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 00:04:03.269369	2026-08-21 00:04:07.727701	0
75c61916-8e03-4d71-adb7-8f53ad886682	BUYER	fef7e933-b5da-4e4e-bd37-32157e61a0a0	100	100	a0000000-0000-0000-0000-000000000001		2026-08-26 13:26:41.122708	2026-08-26 13:26:45.217122	0
a2c1bb86-b2cc-4372-868b-0ec32ae8ebd6	BUYER	5d59bb49-86ee-4ce9-b5ab-777711d57e27	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 00:08:57.413046	2026-08-21 00:08:58.443234	0
a7d7095d-82e6-4e9a-9f8e-fa00f7ada7e4	SELLER_BUSINESS	60555b41-17c0-4214-8109-9c456e54c8ee	60	60	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 04:16:10.425003	2026-08-25 08:01:47.26718	0
7394d087-c9fa-4b26-816c-963e76436cdd	SELLER_BUSINESS	d893d1c9-c0c9-4860-8b8f-174beca4a16b	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 00:08:53.589111	2026-08-21 00:08:58.459138	0
086e8ce3-fe33-4b4d-90c3-c95e899cb327	SELLER_BUSINESS	f09a416f-601e-4666-b24b-9a7e0adbed1e	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-25 08:14:49.188887	2026-08-25 08:14:49.188887	0
9b1d6a5f-8403-41e9-b00a-defc89e8d1ce	BUYER	e6312ce6-9880-49b3-99df-778c8e15d291	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 01:42:17.674798	2026-08-21 01:42:18.411452	0
a4da524f-d700-460f-899f-f586029fcbbb	SELLER_BUSINESS	7c6b46df-b7ac-4b5d-a65b-b9275cdaff5b	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 01:42:13.648747	2026-08-21 01:42:18.439808	0
89c84dc8-f6dc-4067-9284-a921a7f71433	SELLER_BUSINESS	50afee23-0ac7-4bbd-96b2-ec28eea43751	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 11:53:53.540185	2026-08-21 11:53:53.540185	0
1eb9bd07-74d7-4a59-9cc3-2022697d0dc9	BUYER	47879d4c-8514-4e7b-b0ab-e329004c663e	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 01:47:43.096946	2026-08-21 01:47:43.790892	0
346b1493-6180-4756-b7ef-8b7cb9025778	BUYER	1d276ca9-6099-4f30-9798-3b84541bbaba	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:09:25.570846	2026-08-21 14:09:25.570846	0
613853e7-2c80-4eee-948a-3f87b8c584dd	SELLER_BUSINESS	455a57ff-dfb8-48bb-b4f0-f8876ee09ed3	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 01:47:39.617676	2026-08-21 01:47:43.809371	0
fe127396-37d6-4a36-8eea-7bcc6d1f2007	BUYER	8ad7ceaa-1628-4cba-9944-a2614fa76f5a	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:10:33.157604	2026-08-21 14:10:33.157604	0
a6f877f4-e149-4193-9d31-ccc0912d658e	BUYER	8b9a6243-1db9-4a86-822b-68e09d0a7218	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 02:05:52.417834	2026-08-21 02:05:52.6473	0
d3bfb37f-c3c5-4bfe-9d66-06c17c79676c	SELLER_BUSINESS	7cfc4416-8634-4c50-bf24-df5cc030ff3a	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 02:05:48.790875	2026-08-21 02:05:52.654023	0
88888888-8888-8888-8888-888888888888	BUYER	618fc058-92ec-4b10-8453-7a658d867d41	7540	7740	a0000000-0000-0000-0000-000000000004	ACTIVE	2026-08-18 14:22:15.110521	2026-08-18 18:47:14.778974	0
142870cb-0a6e-44fd-b219-b72277762d3f	BUYER	784d5a8f-9f29-421b-b035-2b13beefecdb	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:13:13.725264	2026-08-21 14:13:13.725264	0
cb95e621-84a1-4c8b-baf2-5844d01b6c68	BUYER	48d0a7cf-8cec-4f36-8987-531b73fb082b	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 02:13:59.037264	2026-08-21 02:14:00.101071	0
6e90b71a-099c-4755-a5d4-936235f8f5ee	BUYER	da0a8d9f-bbcd-4289-bb0d-5e7cad42b998	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:14:02.229868	2026-08-21 14:14:02.229868	0
9bfbcb2f-e520-476b-8e82-931018b1b47a	SELLER_BUSINESS	26f0b2ac-6669-40f3-817a-f4832ef0f637	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 02:13:56.641554	2026-08-21 02:14:00.106882	0
cea18d24-b853-47db-b43c-f75bfc58c657	SELLER_BUSINESS	33333333-3333-3333-3333-333333333333	4220	4220	3e1f9f48-fe1d-4ef0-984d-5a4f60104cb4	ACTIVE	2026-08-18 15:19:17.808657	2026-08-18 18:47:14.806488	0
c43dd2ff-eed3-4fcb-9d36-7ef72bba8259	SELLER_BUSINESS	c8742497-cc4c-4f33-948c-647a3a5a15e2	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-20 23:32:41.923497	2026-08-20 23:32:41.923497	0
15dffa72-dd13-409e-9f7b-9832b89504d1	SELLER_BUSINESS	61a5a2ce-bade-4f44-8db1-9d795e9eadf0	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-20 23:40:59.1776	2026-08-20 23:40:59.1776	0
692eea49-7ffa-435e-92ea-d3611af8c9f6	SELLER_BUSINESS	c6d4b097-8eda-4cc7-b30c-86d3826af041	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-20 23:47:25.460362	2026-08-20 23:47:25.460362	0
ae0c5feb-13bb-4807-99cb-7da5b527b3c7	BUYER	5f4e4847-e225-4a76-80cb-a3d5175ddd3d	0	0	a0000000-0000-0000-0000-000000000001		2026-08-20 23:47:29.621915	2026-08-20 23:47:29.621915	0
2058aa40-b867-430e-b67d-b1a5651e287e	BUYER	da41db1c-5d58-4662-a2dc-24ca29b14ec2	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:27:56.173098	2026-08-21 14:27:56.173098	0
3ef0cf37-b3b0-4524-99af-e75c5ddedda4	BUYER	e39b87d2-1c8c-41a4-8c27-55cd44e6cac2	15	15	a0000000-0000-0000-0000-000000000001		2026-08-20 23:54:11.982413	2026-08-20 23:54:12.549058	0
b569a72a-5c69-480d-b0a0-969984403432	BUYER	053c6a5a-073e-4e25-834f-bf1b4abe7766	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 02:48:48.219365	2026-08-21 02:48:49.12692	0
b519c600-c64b-4e7e-b305-c3d3f8625909	SELLER_BUSINESS	30f0fae1-b525-4387-b6b0-412a5d421194	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-20 23:54:07.808311	2026-08-20 23:54:12.563676	0
7ca86910-bdae-40f4-80fc-f7f69f6217f8	BUYER	f091a1b0-7b3e-49fb-ac32-4a80925d11f3	0	0	a0000000-0000-0000-0000-000000000001		2026-08-21 14:29:06.549124	2026-08-21 14:29:06.549124	0
a91152b4-6f2b-450f-b50a-858f63015256	BUYER	3bbcb63f-6caf-4c2e-9d74-6d0252a34297	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 00:02:47.000198	2026-08-21 00:02:48.496853	0
312b5b6b-cb70-4e33-beab-a8f09d36ddcb	SELLER_BUSINESS	34f505dd-a6c5-441e-9fea-10c3c651fa7c	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 02:48:45.231423	2026-08-21 02:48:49.134983	0
3427f665-bbf0-4d58-a2be-67998bb4fb72	SELLER_BUSINESS	406901b9-55dd-461d-ac81-95058a569574	15	15	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 00:02:43.108337	2026-08-21 00:02:48.510884	0
11aa968c-af99-4d9f-ad45-2720acf9b515	SELLER_BUSINESS	13193bb5-b17f-4097-ba81-43005ad5c416	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-22 00:40:24.35104	2026-08-22 00:40:24.35104	0
02dd1c4f-62cf-4875-9652-a4eeb57d3e95	BUYER	4364cacd-338e-4bcf-ae7d-b8f21a857fb9	15	15	a0000000-0000-0000-0000-000000000001		2026-08-21 03:53:55.409872	2026-08-21 03:53:56.009884	0
eac3b70b-d437-44e8-96d4-29e6df715476	SELLER_BUSINESS	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	0	0	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-22 01:07:05.282768	2026-08-22 01:07:05.282768	0
046ad7b0-7480-4075-b983-697846d8b32d	SELLER_BUSINESS	f5bbc830-34b8-45a0-b50d-b16b0a362689	100	100	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-26 13:26:42.442268	2026-08-26 13:26:45.222562	0
72a8f2a5-50c1-4f79-a16a-d9043a9a3f2f	SELLER_BUSINESS	34f536ff-c14c-4a57-a933-930518d428e2	12	12	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 14:11:26.97254	2026-08-26 11:06:38.84968	0
f7169e39-6955-4dbc-ae99-da7f053ed741	BUYER	cfa4847c-bc06-4f1a-8791-c96d71b61579	39	42	a0000000-0000-0000-0000-000000000001	ACTIVE	2026-08-25 07:32:57.712533	2026-08-26 11:06:38.876203	0
49dc6d38-d9f9-4451-8fdc-d18ed65dd0af	BUYER	6ab62b64-af3b-4f3b-9d53-5e38cad0051f	0	0	a0000000-0000-0000-0000-000000000001		2026-08-26 13:17:30.384314	2026-08-26 13:17:30.384314	0
d2ccf774-774e-41ac-ae16-ba498da0255a	SELLER_BUSINESS	91eb7ec0-476f-41f3-9845-af89f864f129	30	30	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-21 03:53:50.988737	2026-08-25 07:33:04.098621	0
d44248fa-4bda-40f0-8703-299af4bc83b4	BUYER	58b991ef-ee6a-40d9-a95e-66f2cf4754b3	0	0	a0000000-0000-0000-0000-000000000001		2026-08-26 13:19:07.243597	2026-08-26 13:19:07.243597	0
4bc7b8e7-886c-4679-a154-8690228be918	BUYER	5fa6e0ec-098a-417d-856f-187eb5aeaa4b	50	50	a0000000-0000-0000-0000-000000000001		2026-08-26 18:33:38.624715	2026-08-26 18:35:10.595822	0
d4b499b3-abb8-472c-bf90-7da78198b2c9	BUYER	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	45	45	a0000000-0000-0000-0000-000000000001		2026-08-21 04:16:14.039358	2026-08-25 08:01:47.261052	0
eec2ecb0-5063-4ac1-a2d6-284209a1aded	SELLER_BUSINESS	28158bd6-cd39-49a8-a0a9-58ec324473bc	50	50	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-26 15:55:26.204578	2026-08-26 18:35:10.601342	0
dbb0bb66-e789-4a70-a11f-5030e7f1073b	BUYER	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	100	100	a0000000-0000-0000-0000-000000000001		2026-08-26 13:28:13.554304	2026-08-26 13:28:17.545965	0
17a820be-1bbe-4c8e-b626-45d6b73de925	SELLER_BUSINESS	1ba51d3e-52e7-40ec-878d-55a7d135bdad	100	100	7ccce069-ee5c-42fc-8586-e965e88f2071	ACTIVE	2026-08-26 13:28:15.288124	2026-08-26 13:28:17.557685	0
\.


--
-- Data for Name: point_config; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.point_config (key, value, description, updated_at) FROM stdin;
earn_rate	1000.0000	CDF per 1 point earned	2026-08-18 13:56:28.564954
redeem_rate	1000.0000	CDF discount per 1 point redeemed	2026-08-18 13:56:28.564954
max_point_coverage	20.0000	Maximum percent of order total coverable by points	2026-08-18 13:56:28.564954
max_delivery_point_coverage	100.0000	Maximum percent of delivery fee coverable by points	2026-08-18 13:56:28.69461
\.


--
-- Data for Name: point_transactions; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.point_transactions (id, point_account_id, reference_type, reference_id, type, points_change, previous_points, new_points, created_at) FROM stdin;
6bb00e4a-8fbd-4831-80ed-39f99281c4b8	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	e60ed1d4-6ddd-4e7e-a84f-b117e8b31448	CREDIT	160	5160	5320	2026-08-18 15:27:58.549415
97b330ad-ccae-4820-8a1b-c38de6cdce96	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	e60ed1d4-6ddd-4e7e-a84f-b117e8b31448	CREDIT	160	1120	1280	2026-08-18 15:27:58.565532
1589d089-fe57-4571-82dd-1a07a02874a1	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	1f2a36a2-6468-4624-a7ee-e19756b0e16b	CREDIT	200	4960	5160	2026-08-18 15:29:16.872523
557ead75-15fd-4415-92cf-667e76125f64	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	1f2a36a2-6468-4624-a7ee-e19756b0e16b	CREDIT	200	1280	1480	2026-08-18 15:29:16.889403
b327c2f8-e8b6-45f3-a8b7-01f7be01a91c	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	08276147-6f23-4aa3-8a78-8d31256c26e3	CREDIT	160	5160	5320	2026-08-18 15:29:22.608567
6a4cb642-4910-4720-8cb4-1aafd1a42cff	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	08276147-6f23-4aa3-8a78-8d31256c26e3	CREDIT	160	1480	1640	2026-08-18 15:29:22.621271
7cc5d83c-1820-453a-ac46-5655f5d5e4ff	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	6be8c180-1ca6-4071-8383-16ab137f9aaa	DEBIT	40	5320	5280	2026-08-18 15:29:22.643072
a49b3e86-e992-46d5-9f4d-7f03e5b18936	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f0cd8d45-39e3-4361-bd7b-986243e1697d	DEBIT	40	5280	5280	2026-08-18 16:00:52.013468
6932cd0a-b706-465d-a29f-920d7674bcc6	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f0cd8d45-39e3-4361-bd7b-986243e1697d	CREDIT	40	5280	5280	2026-08-18 16:00:52.081602
fc6027c2-6f69-45d7-81e6-921b2b6157a2	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	8846a378-8f04-4b52-9064-f225900dffbd	DEBIT	10	5280	5280	2026-08-18 16:00:52.121041
08f90528-c0e2-4782-aa84-f54e3a2de606	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	8846a378-8f04-4b52-9064-f225900dffbd	CREDIT	10	5280	5280	2026-08-18 16:00:52.145632
f2e64107-6399-4e49-967d-aa43898d14f7	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	3e7edc30-6f64-4416-86e9-989a50ff38fe	DEBIT	40	5280	5280	2026-08-18 16:00:52.169188
ceee8673-b902-4916-8eff-58a370a8cbf1	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	3e7edc30-6f64-4416-86e9-989a50ff38fe	DEBIT	10	5280	5280	2026-08-18 16:00:52.18665
5ace5952-4421-47b7-abd1-3159fb0acaf1	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	3e7edc30-6f64-4416-86e9-989a50ff38fe	CREDIT	40	5280	5280	2026-08-18 16:00:52.23415
8c09db54-3595-4299-99e4-88a1081d0fa1	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	3e7edc30-6f64-4416-86e9-989a50ff38fe	CREDIT	10	5280	5280	2026-08-18 16:00:52.23415
56da4246-d0c6-461a-816c-bd2d36376d88	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	c5a417b3-e2fa-4de0-a42a-5ba341b71ce6	DEBIT	40	5280	5280	2026-08-18 16:00:53.790193
00fcf3c6-8266-42c0-affa-5a2d4094f8f2	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	c5a417b3-e2fa-4de0-a42a-5ba341b71ce6	DEBIT	10	5280	5280	2026-08-18 16:00:53.82548
ab60bf3f-ca55-4bf3-9ab3-2137abc80d13	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	c5a417b3-e2fa-4de0-a42a-5ba341b71ce6	CREDIT	40	5280	5280	2026-08-18 16:00:54.551406
9970525e-1109-438d-8749-222c073a9b3e	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	c5a417b3-e2fa-4de0-a42a-5ba341b71ce6	CREDIT	10	5280	5280	2026-08-18 16:00:54.551406
119783c9-8e6f-408a-bcf2-2d9966dfc062	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a5bf5fab-1107-4435-b6da-0c5111285df7	DEBIT	40	5680	5680	2026-08-18 16:01:01.777116
aae41e3c-f9a6-487e-b0f6-2ae06c49e921	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	7e34792f-b1e9-4652-9da3-3c46ef787165	CREDIT	160	5680	5840	2026-08-18 16:01:02.211964
5ac3020b-cdb3-4103-b108-a1d40dff05bb	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	6d909d05-7f24-409a-adc7-eb01336e8280	CREDIT	200	4960	5160	2026-08-18 15:19:17.790295
b14771ef-fa89-4812-8ee0-9a241a6785ed	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	4b544180-0d19-4f44-9555-afbc07fc4ce1	CREDIT	200	4960	5160	2026-08-18 15:19:17.793899
f768002c-0dda-4a22-90d1-c028709bd924	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	6d909d05-7f24-409a-adc7-eb01336e8280	CREDIT	200	0	200	2026-08-18 15:19:17.815101
37872682-72f2-40ad-bc51-0b9668f972fe	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	7e34792f-b1e9-4652-9da3-3c46ef787165	CREDIT	160	2040	2200	2026-08-18 16:01:02.227934
b6398b5d-5aab-4414-8036-c600dd89a441	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a5bf5fab-1107-4435-b6da-0c5111285df7	DEBIT	40	5840	5800	2026-08-18 16:01:02.255033
5f437058-47e3-43de-a2e6-79b958475ec4	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	f4688dd8-6c1b-4b8b-885b-5dca5c9bbd48	CREDIT	160	5160	5320	2026-08-18 15:19:23.710643
7960e8ec-c10e-4aa2-9bd4-0fc88aa4b866	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	f4688dd8-6c1b-4b8b-885b-5dca5c9bbd48	CREDIT	160	200	360	2026-08-18 15:19:23.731251
2246e5af-0d7c-4a05-b6d3-c2423a8b7a3f	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f72a9b78-f6c9-4e60-afc7-43b9f54f0332	DEBIT	40	5800	5800	2026-08-18 16:01:11.328173
17473e75-80d6-4fe6-a0ed-69c36e1a0687	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f72a9b78-f6c9-4e60-afc7-43b9f54f0332	DEBIT	10	5800	5800	2026-08-18 16:01:11.339526
db19b420-a191-4fcd-b3ac-1fcbe3258101	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f72a9b78-f6c9-4e60-afc7-43b9f54f0332	CREDIT	40	5800	5800	2026-08-18 16:01:11.636683
694e63d4-8900-4acf-8605-845fc7e5c083	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f72a9b78-f6c9-4e60-afc7-43b9f54f0332	CREDIT	10	5800	5800	2026-08-18 16:01:11.636683
a7798ca7-a394-4af7-b777-932cb080a4cb	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	60581147-394a-4f65-9633-33f0e8b35ced	DEBIT	10	5800	5800	2026-08-18 16:01:11.937729
2c856600-c764-49f3-a832-32b757016a98	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	60581147-394a-4f65-9633-33f0e8b35ced	CREDIT	10	5800	5800	2026-08-18 16:01:11.951171
4465e188-6106-4887-952c-ff1ed407ed72	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	41f30350-e75d-4f08-a983-c65e0d2bce17	DEBIT	40	5800	5800	2026-08-18 16:01:13.029764
5c318bfe-8cf0-4825-931a-4d0e5106816d	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	58c5f2ca-1dbf-4412-b2de-290988d62ed6	DEBIT	40	5800	5800	2026-08-18 16:01:13.104479
8dfe8e4c-a7f4-4baf-9151-96d96891ebb1	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	41f30350-e75d-4f08-a983-c65e0d2bce17	CREDIT	40	5800	5800	2026-08-18 16:01:13.492027
2443be7f-dcd9-432a-af41-c254f07a984b	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	58c5f2ca-1dbf-4412-b2de-290988d62ed6	CREDIT	40	5800	5800	2026-08-18 16:01:13.526432
6cb8c613-3d03-491f-b6b1-05b4a5867595	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	17044b64-39fa-4b58-a217-2f2c2a04f771	CREDIT	100	5800	5900	2026-08-18 16:11:43.006187
77c88454-39f7-418d-9af0-0b856391a22f	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	17044b64-39fa-4b58-a217-2f2c2a04f771	CREDIT	100	2200	2300	2026-08-18 16:11:43.027499
fcabeca3-3b38-4e25-a725-bdb4004d999d	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	669c8181-5c83-479f-ae8f-7aeeb49fe94f	CREDIT	100	5900	6000	2026-08-18 16:11:44.462098
5bab1aa7-5622-48da-975d-9d39c0ac3ede	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	669c8181-5c83-479f-ae8f-7aeeb49fe94f	CREDIT	100	2300	2400	2026-08-18 16:11:44.48391
e3cd6f5d-c74e-498c-91b6-1e358f302f8a	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	d4aa35c1-6a0f-4c09-9461-037d7dd83301	CREDIT	100	6100	6200	2026-08-18 16:23:43.660266
122599c5-9895-4d0e-a757-f1988673eecf	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	3841d04c-5189-427b-b2b5-eb34472eeb96	CREDIT	100	6100	6200	2026-08-18 16:23:43.673127
14cb920f-fd6f-490c-9b9a-fcb1b3da7991	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	d4aa35c1-6a0f-4c09-9461-037d7dd83301	CREDIT	100	2500	2600	2026-08-18 16:23:43.695529
dadfedd9-ea56-44f9-961a-75da696c0bda	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	3841d04c-5189-427b-b2b5-eb34472eeb96	CREDIT	100	2600	2700	2026-08-18 16:23:43.7143
754ff7dc-8c5a-4a0a-b29c-4870c9aad6c0	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	bb5d934f-5b7c-4b33-8f82-452fcbefaf58	CREDIT	200	6200	6400	2026-08-18 16:24:04.891473
7a9fd708-a014-4b9a-b23f-9416b3c728a3	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	bb5d934f-5b7c-4b33-8f82-452fcbefaf58	CREDIT	200	2800	3000	2026-08-18 16:24:04.910154
6aecc369-f0fa-44f5-b11f-9c125b839db5	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	fdec1c18-e357-42ba-b6db-2ca79767210f	CREDIT	40	6520	6520	2026-08-18 16:24:26.006488
90923973-52bf-4735-a6df-c99cbb575712	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	8218d356-6f87-4601-880d-be47ac8b0deb	CREDIT	100	6620	6720	2026-08-18 18:21:37.165277
9dfa504b-d334-4ede-a465-e4b1c83268e0	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	8218d356-6f87-4601-880d-be47ac8b0deb	CREDIT	100	3260	3360	2026-08-18 18:21:37.174816
43010bc1-b2ea-48eb-8f5b-3385c3951314	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	987e80b5-45df-4a27-b30a-d57a2b008a01	CREDIT	100	6920	7020	2026-08-18 18:44:52.860647
09f2b250-b8d7-4fec-bfe2-fba53bf04ae6	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	987e80b5-45df-4a27-b30a-d57a2b008a01	CREDIT	100	3560	3660	2026-08-18 18:44:52.86885
214ac47e-4c3b-44ff-86ef-771aac525a5d	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	e8bbebe1-d6eb-4225-83ae-5ef5fad692f6	CREDIT	200	7020	7220	2026-08-18 18:46:04.925285
e020b7c5-d82a-4550-89d4-5d30ab6fc48d	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	e8bbebe1-d6eb-4225-83ae-5ef5fad692f6	CREDIT	200	3660	3860	2026-08-18 18:46:04.93684
ab4bf16f-0b25-439d-9f23-89ea45924e36	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f7d9c801-9e9c-4896-9435-1b84c9686303	CREDIT	10	7340	7340	2026-08-18 18:46:19.680005
72f89f75-0e88-4bf9-ac74-bd5348d15906	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	5d173cc0-e8c2-4763-bfc5-2ceeb34e7909	DEBIT	10	7340	7340	2026-08-18 18:46:19.96945
3884a7d9-4f10-4506-b4be-2d82ded6639b	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	5d173cc0-e8c2-4763-bfc5-2ceeb34e7909	CREDIT	10	7340	7340	2026-08-18 18:46:19.985363
fb5e57c8-e4da-43a7-ba66-62896e07f424	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a903148f-09cc-4acc-b5a2-75126c341126	DEBIT	40	7340	7340	2026-08-18 18:46:21.097509
f54bcfd6-08fa-41f5-9abf-fdf502b5a36a	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	313c099b-64ba-4b3e-9589-c1672ee0384a	DEBIT	40	7340	7340	2026-08-18 18:46:21.154873
42329752-41da-4d30-bb85-c71db599770b	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a903148f-09cc-4acc-b5a2-75126c341126	CREDIT	40	7340	7340	2026-08-18 18:46:21.529679
4d5db70d-2e73-4fbe-8a84-4133a9f91171	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	313c099b-64ba-4b3e-9589-c1672ee0384a	CREDIT	40	7340	7340	2026-08-18 18:46:21.543052
15fba358-8c84-47e3-9035-45774dbc7708	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	1bc2711c-2bf5-4bee-9af3-94d664fdcef7	CREDIT	100	7340	7440	2026-08-18 18:47:14.745891
deee8a0d-b4b6-4bac-a2dc-d9aff21276f4	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	6509d4ba-e43f-4548-bc3c-d03c5801e932	CREDIT	100	7340	7440	2026-08-18 18:47:14.745874
5a60394b-5499-408c-a20c-a4fd9c75ee0c	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	755f868f-f750-4d9c-8f6c-a7766a5c5b2f	CREDIT	100	7340	7440	2026-08-18 18:47:14.749495
ff907cf8-1abe-4ae3-9e19-34a9f893d427	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	a730933a-558f-4a6d-abef-6df5d5de76da	CREDIT	200	4960	5160	2026-08-18 15:27:52.589252
f1d97fd6-87e5-4eba-9987-1cb04d89d42d	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	a730933a-558f-4a6d-abef-6df5d5de76da	CREDIT	200	920	1120	2026-08-18 15:27:52.604505
33c5b2b4-abf3-4bf7-b63b-fb43b8980d63	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	1681e485-1cbd-40fa-88fe-096c70a51812	DEBIT	40	4960	4960	2026-08-18 15:29:13.696221
07505fe7-9451-45c2-8eab-8bfb9a006b50	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	1681e485-1cbd-40fa-88fe-096c70a51812	CREDIT	40	4960	4960	2026-08-18 15:29:13.739371
42e8a7b9-a91c-4501-9503-587798d9ac1f	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	01fd85cb-f05a-4795-a4cd-f8dc65cc3401	DEBIT	10	4960	4960	2026-08-18 15:29:13.76392
ec6a7a5a-35cf-4db9-aa59-cf8808978914	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	01fd85cb-f05a-4795-a4cd-f8dc65cc3401	CREDIT	10	4960	4960	2026-08-18 15:29:13.783443
4fb18a84-acae-4658-827e-8910add87a3c	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	9eaffcea-d171-4221-8e97-70cd0eec19dd	DEBIT	40	4960	4960	2026-08-18 15:29:13.80175
2681dd98-b064-4b7d-bc55-8f45853a447f	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9eaffcea-d171-4221-8e97-70cd0eec19dd	DEBIT	10	4960	4960	2026-08-18 15:29:13.813011
65355950-077a-4c84-be9f-e13e804a2960	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	9eaffcea-d171-4221-8e97-70cd0eec19dd	CREDIT	40	4960	4960	2026-08-18 15:29:13.836162
01674f99-894c-45ba-8969-36d165d4f757	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9eaffcea-d171-4221-8e97-70cd0eec19dd	CREDIT	10	4960	4960	2026-08-18 15:29:13.836162
9f64e3ed-1f00-4d25-88c0-7f512bc1915d	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	3febfa86-0c23-4593-bc3a-01c767bc993c	DEBIT	40	4960	4960	2026-08-18 15:29:14.83794
7a145468-f8fd-4925-8ba6-954c150926c3	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	3febfa86-0c23-4593-bc3a-01c767bc993c	DEBIT	10	4960	4960	2026-08-18 15:29:14.849856
17248e4e-3a81-4512-a2ad-174e72cf16f9	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	3febfa86-0c23-4593-bc3a-01c767bc993c	CREDIT	40	4960	4960	2026-08-18 15:29:15.146378
3da9988f-76be-4636-81ba-ae123f6d6e5a	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	3febfa86-0c23-4593-bc3a-01c767bc993c	CREDIT	10	4960	4960	2026-08-18 15:29:15.146378
e856b6c1-0e13-40c6-898f-af2aa2c3c727	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	6be8c180-1ca6-4071-8383-16ab137f9aaa	DEBIT	40	5160	5160	2026-08-18 15:29:21.232264
f45f9d26-b6e3-4728-9cc7-82c105b9dbd6	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	b9c3aa06-795a-47f4-9606-9d416be80b69	DEBIT	40	5280	5280	2026-08-18 15:29:30.662165
fc76afcc-21f2-425d-9cd2-9eb31cbb58f6	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	b9c3aa06-795a-47f4-9606-9d416be80b69	DEBIT	10	5280	5280	2026-08-18 15:29:30.674657
0f07cc40-9bfd-4833-b3bb-b98e34f46770	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	b9c3aa06-795a-47f4-9606-9d416be80b69	CREDIT	40	5280	5280	2026-08-18 15:29:30.966031
746e0750-08af-4f92-a19b-d9ab098da1bc	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	b9c3aa06-795a-47f4-9606-9d416be80b69	CREDIT	10	5280	5280	2026-08-18 15:29:30.966031
4060d3da-f107-44af-bee4-e1a8a1d3e6c5	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	1e957720-e3ad-4ef6-b52f-23165188eb22	DEBIT	10	5280	5280	2026-08-18 15:29:31.329995
bffd4d4b-f00e-414d-b448-8886a5cadd76	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	1e957720-e3ad-4ef6-b52f-23165188eb22	CREDIT	10	5280	5280	2026-08-18 15:29:31.347105
3c476d3a-a95d-457c-a877-2f503901fad0	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	1f238e87-eeed-4d57-b288-163c573e19d6	DEBIT	40	5280	5280	2026-08-18 15:29:32.653586
9dccebc8-897c-460b-9d90-77f5c99f96c7	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	86fba350-f321-4368-a54a-198687c1291f	DEBIT	40	5280	5280	2026-08-18 15:29:32.712112
080c523a-18a8-44b9-9b41-e70340aeda3a	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	1f238e87-eeed-4d57-b288-163c573e19d6	CREDIT	40	5280	5280	2026-08-18 15:29:33.088591
4cac659b-d9d8-4dfc-80ce-e69e8306cd88	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	86fba350-f321-4368-a54a-198687c1291f	CREDIT	40	5280	5280	2026-08-18 15:29:33.1032
3040d735-5491-440a-9382-0a5ef5c67c87	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	e7232481-1c1d-4b34-9158-e3ab540ee7c5	CREDIT	200	5280	5480	2026-08-18 16:00:56.540834
227d34df-53a3-48f6-8afd-91cbd51b6c2a	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	e7232481-1c1d-4b34-9158-e3ab540ee7c5	CREDIT	200	1640	1840	2026-08-18 16:00:56.566539
6c24963e-a203-4f01-b7a0-fe27ae67dbfd	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	06431201-adb0-40c0-95e7-8d88eaa7a6a5	CREDIT	100	6000	6100	2026-08-18 16:11:44.506488
7501cd4a-49a4-4878-837c-18972fd80f2b	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	06431201-adb0-40c0-95e7-8d88eaa7a6a5	CREDIT	100	2400	2500	2026-08-18 16:11:44.533182
ae219918-485f-4b6e-8b61-a0ac3e43381f	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	9e6c6661-2e9a-48c3-9bc0-776f64cdf5ec	CREDIT	100	6100	6200	2026-08-18 16:23:43.671256
9a31dd53-c6a4-40ff-aad9-ee100dd32f25	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	10bc26db-962d-4425-b76b-76ecb8cb9a7b	CREDIT	100	6100	6200	2026-08-18 16:23:43.673421
28bb1eaf-e2c0-444a-a2b0-aa464871e3bf	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	9e6c6661-2e9a-48c3-9bc0-776f64cdf5ec	CREDIT	100	2600	2700	2026-08-18 16:23:43.709195
f6f25a15-c382-4325-a062-283e0415d807	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	10bc26db-962d-4425-b76b-76ecb8cb9a7b	CREDIT	100	2700	2800	2026-08-18 16:23:43.722372
74b61568-fa64-4206-8b50-ca0f4ae8fa9d	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	392ab99e-57c0-4d81-8a13-5b718c3b5de2	CREDIT	200	6200	6400	2026-08-18 16:24:04.891743
a6669b41-704f-4daa-85ce-02ba7fbd12c4	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	392ab99e-57c0-4d81-8a13-5b718c3b5de2	CREDIT	200	2800	3000	2026-08-18 16:24:04.912859
86be7aee-e03b-45be-b8e9-ad1a58f0bedf	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	dfd23b86-a22c-4013-a8ff-83aebd55fa30	CREDIT	160	6400	6560	2026-08-18 16:24:11.230365
d4127bd6-7755-48bc-b150-7617eedb9b17	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	dfd23b86-a22c-4013-a8ff-83aebd55fa30	CREDIT	160	3000	3160	2026-08-18 16:24:11.253397
74328407-eae6-48c4-bb81-a96da06a9e03	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a40da62a-97ca-41ac-b824-cfd747a22e95	DEBIT	40	6560	6520	2026-08-18 16:24:11.308651
42bf5080-0e51-4643-9a17-a55c977307d2	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	51da30e9-cfda-4bfd-994d-ecf42450f1a6	CREDIT	100	6520	6620	2026-08-18 18:02:23.29261
44d22dc2-5cbf-4ba5-962c-74a5a2706a2f	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	51da30e9-cfda-4bfd-994d-ecf42450f1a6	CREDIT	100	3160	3260	2026-08-18 18:02:23.322322
c412e9d3-08d2-4a8d-8d91-a539f1004142	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	5c029322-8307-40a9-86e6-2fad14e834ab	CREDIT	100	6720	6820	2026-08-18 18:29:08.266891
26b5925a-9461-4bfa-ba9b-8299eea4d272	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	5c029322-8307-40a9-86e6-2fad14e834ab	CREDIT	100	3360	3460	2026-08-18 18:29:08.279001
9f481732-c65d-489d-aa4b-1266029bf064	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	ada010c5-566b-4ad1-9872-1724ad58d361	CREDIT	100	6820	6920	2026-08-18 18:42:46.445319
362d6014-a913-4625-ad5c-2f5fb57522d7	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	ada010c5-566b-4ad1-9872-1724ad58d361	CREDIT	100	3460	3560	2026-08-18 18:42:46.46017
22fe7ed4-acae-4fdd-838c-1caaebdcdd89	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	458db372-66f9-4a87-b69e-aebee10bea21	DEBIT	40	7020	7020	2026-08-18 18:46:02.975232
07748ea2-1bf5-4d7f-b6eb-466e303fb602	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	458db372-66f9-4a87-b69e-aebee10bea21	CREDIT	40	7020	7020	2026-08-18 18:46:03.025223
a5fb103c-3f08-450e-a51f-0530d57e3ea4	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9e795b64-c37a-440e-9664-7879ebfbd5c2	DEBIT	10	7020	7020	2026-08-18 18:46:03.047322
1825674d-c40a-418d-97e4-8615cf5f9f0f	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9e795b64-c37a-440e-9664-7879ebfbd5c2	CREDIT	10	7020	7020	2026-08-18 18:46:03.063918
bd9d407f-6e07-4e8a-8089-6efe74e31467	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f7578de3-2ad5-470e-b3b4-dfaac5839815	DEBIT	40	7020	7020	2026-08-18 18:46:03.077912
358586cb-c45e-4469-ae2d-7a9923f26d62	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f7578de3-2ad5-470e-b3b4-dfaac5839815	DEBIT	10	7020	7020	2026-08-18 18:46:03.089576
49343a66-8029-4d47-bd5e-94432e3825e4	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f7578de3-2ad5-470e-b3b4-dfaac5839815	CREDIT	40	7020	7020	2026-08-18 18:46:03.113323
89bfc83f-d88d-443b-8c4e-258a7dce3e29	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f7578de3-2ad5-470e-b3b4-dfaac5839815	CREDIT	10	7020	7020	2026-08-18 18:46:03.113323
1fcce908-04c0-43e4-b661-14a420e92884	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	474aa832-4922-4510-8ff6-095c259ed2ed	DEBIT	40	7020	7020	2026-08-18 18:46:04.007546
07247e32-1ef7-4cc8-ae7e-8d69a3db53df	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	474aa832-4922-4510-8ff6-095c259ed2ed	DEBIT	10	7020	7020	2026-08-18 18:46:04.020519
98bede2b-1cfb-4a22-9213-4a3916742e92	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	474aa832-4922-4510-8ff6-095c259ed2ed	CREDIT	40	7020	7020	2026-08-18 18:46:04.314196
64368a44-2dac-4e62-bd8f-7a9246503866	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	474aa832-4922-4510-8ff6-095c259ed2ed	CREDIT	10	7020	7020	2026-08-18 18:46:04.314196
195ee2ad-f42d-4033-8ebb-d39c58c820a6	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	7b6d1d70-73ad-4bb7-9eee-ab7f9eec9d28	CREDIT	200	7020	7220	2026-08-18 18:46:04.928401
b3051c84-2e2e-49f3-ac75-cad025bd124e	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	7b6d1d70-73ad-4bb7-9eee-ab7f9eec9d28	CREDIT	200	3660	3860	2026-08-18 18:46:04.943562
d4f8795e-ce4c-4a1b-bd90-dc65d96d5fcd	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	af3f0242-4d91-4b32-b9cd-3861aa6055a9	DEBIT	40	7220	7220	2026-08-18 18:46:10.280672
91f1e97b-d5d6-48f3-8f85-f2a5f85089e2	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	d02f4c18-1b5e-4ccb-a3e3-60a619125f38	CREDIT	160	7220	7380	2026-08-18 18:46:10.582274
1e95b659-4a46-442c-83d6-8519bac4aa3f	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	d02f4c18-1b5e-4ccb-a3e3-60a619125f38	CREDIT	160	3860	4020	2026-08-18 18:46:10.594399
749f5b5b-10f9-48d2-ac65-0548ba6600e9	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	af3f0242-4d91-4b32-b9cd-3861aa6055a9	DEBIT	40	7380	7340	2026-08-18 18:46:10.615975
cfde8fc2-604b-4a8b-8096-0bbda7f8344f	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f7d9c801-9e9c-4896-9435-1b84c9686303	DEBIT	40	7340	7340	2026-08-18 18:46:19.390529
3144b8f4-d64c-4a19-8f41-9fbbb5a1ea2a	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	f7d9c801-9e9c-4896-9435-1b84c9686303	DEBIT	10	7340	7340	2026-08-18 18:46:19.403543
c9f40054-d425-4738-a2fa-53abcbc88e88	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	f7d9c801-9e9c-4896-9435-1b84c9686303	CREDIT	40	7340	7340	2026-08-18 18:46:19.680005
513ea2ae-7dec-4d25-8aca-2e59fd7d2ef0	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	4b544180-0d19-4f44-9555-afbc07fc4ce1	CREDIT	200	360	560	2026-08-18 15:20:02.204008
8c8ea87b-a8d3-42e2-8fc2-24ec7b09e728	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	60d94632-0656-4e16-8e7c-4a97e39cc717	CREDIT	200	4960	5160	2026-08-18 15:21:22.346102
87fac68e-676f-48da-9add-b65452585073	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	d10a0864-7ae0-4925-ac47-2075fc3d9aed	CREDIT	200	4960	5160	2026-08-18 15:21:22.347273
1c277b8f-2985-4450-9bed-0022c6227c0e	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	d10a0864-7ae0-4925-ac47-2075fc3d9aed	CREDIT	200	560	760	2026-08-18 15:21:22.364183
807f4f1c-3f77-4a48-818f-e6c75ae9ce35	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	60d94632-0656-4e16-8e7c-4a97e39cc717	CREDIT	200	560	760	2026-08-18 15:21:22.366992
213bad1a-e26f-4ceb-adca-cf4ffcfb0b66	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	8bcb3b61-b771-4572-bbae-8e8d699e09f0	CREDIT	160	5160	5320	2026-08-18 15:21:28.134084
73eefc34-291c-4496-b038-bcb0260cecab	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	8bcb3b61-b771-4572-bbae-8e8d699e09f0	CREDIT	160	760	920	2026-08-18 15:21:28.149392
684efb52-ccb3-43e5-8d14-9688d390b1fa	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	2bc7e612-5971-440a-b7db-40b2dd129582	CREDIT	200	4960	5160	2026-08-18 15:27:52.594321
941107ba-96d1-4545-9814-0edecda201be	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	2bc7e612-5971-440a-b7db-40b2dd129582	CREDIT	200	920	1120	2026-08-18 15:27:52.606704
d293cf6d-8e06-4d0b-9681-6492becc52b5	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	2280ad4e-5308-483c-bbab-eb548da4bcc4	CREDIT	200	4960	5160	2026-08-18 15:29:16.872282
106ee330-3ad5-4096-9164-d8adc9cd65e7	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	2280ad4e-5308-483c-bbab-eb548da4bcc4	CREDIT	200	1280	1480	2026-08-18 15:29:16.887049
87c6940c-2d27-47ab-9237-14e965e9f30d	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	1f6c0f20-31f1-49df-a08a-48cd3dd25e77	CREDIT	200	5480	5680	2026-08-18 16:00:56.560694
df695ed3-1408-419a-a248-d5dd034200ad	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	1f6c0f20-31f1-49df-a08a-48cd3dd25e77	CREDIT	200	1840	2040	2026-08-18 16:00:56.584905
3a53fcac-a580-4535-9202-a743bac7e7a2	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	64aeb077-734b-426f-921b-40350c3f8867	CREDIT	100	6000	6100	2026-08-18 16:11:44.515565
0cad6e04-1cac-458b-b402-53c9456bf7b8	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	64aeb077-734b-426f-921b-40350c3f8867	CREDIT	100	2400	2500	2026-08-18 16:11:44.53877
a18ca1d2-7213-40ef-94db-b009dd748603	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	3ab93154-37d5-42db-b88f-76c4236b6a7a	CREDIT	100	6100	6200	2026-08-18 16:23:43.671222
d7fe3f5e-da13-4f68-be9d-4857d96cd547	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	3ab93154-37d5-42db-b88f-76c4236b6a7a	CREDIT	100	2600	2700	2026-08-18 16:23:43.716814
b9bc2aa0-adc9-4509-bb52-63cd2f2473f0	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	2b27201c-dcc8-490e-bf6b-3c4f833ab492	DEBIT	40	6200	6200	2026-08-18 16:24:01.407689
72fe06de-d3c7-4701-9e3e-6dafbb4b0a62	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	2b27201c-dcc8-490e-bf6b-3c4f833ab492	CREDIT	40	6200	6200	2026-08-18 16:24:01.472147
11f6c3b8-909e-4f0e-be2d-2639d2a7b6a9	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9da82d4e-47d7-4b97-b841-61a9eabdbfbb	DEBIT	10	6200	6200	2026-08-18 16:24:01.509282
2e26a700-883d-418f-a7ab-202d2d7c43de	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9da82d4e-47d7-4b97-b841-61a9eabdbfbb	CREDIT	10	6200	6200	2026-08-18 16:24:01.536066
967a459e-0515-4c49-8adc-dc5ea8d861a7	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	e533d88a-5554-48d3-aea2-aefeb4af35f2	DEBIT	40	6200	6200	2026-08-18 16:24:01.558194
9aefe81e-fc14-4b94-a815-a063b979533b	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	e533d88a-5554-48d3-aea2-aefeb4af35f2	DEBIT	10	6200	6200	2026-08-18 16:24:01.572964
91475d0e-6259-4504-a52d-77b0b929ead6	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	e533d88a-5554-48d3-aea2-aefeb4af35f2	CREDIT	40	6200	6200	2026-08-18 16:24:01.605501
b165102e-3e7d-4933-b6a0-4ef48941b8b7	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	e533d88a-5554-48d3-aea2-aefeb4af35f2	CREDIT	10	6200	6200	2026-08-18 16:24:01.605501
2af5e114-aba0-4d56-b4b5-b7d4b97100e1	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	e8af2733-c39b-4abf-b366-d47f94adeb1e	DEBIT	40	6200	6200	2026-08-18 16:24:03.205393
ba38d6f2-d0e6-4d4f-8607-e6f422f2a5fe	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	e8af2733-c39b-4abf-b366-d47f94adeb1e	DEBIT	10	6200	6200	2026-08-18 16:24:03.227627
f2943434-592b-4df6-a500-d5c32061eafc	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	e8af2733-c39b-4abf-b366-d47f94adeb1e	CREDIT	40	6200	6200	2026-08-18 16:24:03.859027
3d119169-d092-4b4e-93ae-eb14b4c25600	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	e8af2733-c39b-4abf-b366-d47f94adeb1e	CREDIT	10	6200	6200	2026-08-18 16:24:03.859027
b4f91ec5-3312-4a48-a2f2-50514f774ff0	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a40da62a-97ca-41ac-b824-cfd747a22e95	DEBIT	40	6400	6400	2026-08-18 16:24:10.511579
095d91e1-e6a5-49dd-b123-1e1551e1dea8	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	a40da62a-97ca-41ac-b824-cfd747a22e95	CREDIT	40	6520	6520	2026-08-18 16:24:19.278063
29197b96-6110-46d1-8229-591a8b02b4ed	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	97efadb6-9525-4bb1-873f-6d98c56a02f2	DEBIT	40	6520	6520	2026-08-18 16:24:20.967805
d03f9e92-a340-4160-a1a7-d5565ce11571	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	97efadb6-9525-4bb1-873f-6d98c56a02f2	DEBIT	10	6520	6520	2026-08-18 16:24:20.984631
5597befe-11d6-4912-9a25-d5d526168b80	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	97efadb6-9525-4bb1-873f-6d98c56a02f2	CREDIT	40	6520	6520	2026-08-18 16:24:21.846512
a53ef904-317a-459c-87e7-0bcc22866fa3	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	97efadb6-9525-4bb1-873f-6d98c56a02f2	CREDIT	10	6520	6520	2026-08-18 16:24:21.846512
5bad6788-1aa9-4473-9648-278fb3a92c79	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9e3447eb-fd59-489c-a864-036ceadb8f53	DEBIT	10	6520	6520	2026-08-18 16:24:22.455264
62c607b1-1dd9-4caf-a846-84c3fd28f42c	88888888-8888-8888-8888-888888888888	REDEMPTION_DELIVERY	9e3447eb-fd59-489c-a864-036ceadb8f53	CREDIT	10	6520	6520	2026-08-18 16:24:22.481888
ff7379b8-f4be-459e-8f97-64addefc4816	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	934f951c-aa54-454a-a815-6bacfeca64e2	DEBIT	40	6520	6520	2026-08-18 16:24:24.87493
6784bc58-af52-44f5-ba43-0f23b6124cf5	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	fdec1c18-e357-42ba-b6db-2ca79767210f	DEBIT	40	6520	6520	2026-08-18 16:24:25.187963
22857baf-9dc6-4556-aca1-bd2080520b5e	88888888-8888-8888-8888-888888888888	REDEMPTION_PRODUCT	934f951c-aa54-454a-a815-6bacfeca64e2	CREDIT	40	6520	6520	2026-08-18 16:24:25.986836
b0b26ac8-2df3-404e-b9d6-6babd8c13923	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	556324a1-05ca-4173-b30d-f2f27d677d2a	CREDIT	100	7340	7440	2026-08-18 18:47:14.75445
9b8a0e78-b009-4183-9c0a-5545ae30c0a7	88888888-8888-8888-8888-888888888888	VERIFIED_PURCHASE	4ac229bc-4227-46b0-9537-5c71b1749457	CREDIT	100	7440	7540	2026-08-18 18:47:14.757773
d8fc5c9e-433a-442b-bd81-7bd1cd847aed	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	556324a1-05ca-4173-b30d-f2f27d677d2a	CREDIT	100	4120	4220	2026-08-18 18:47:14.783675
ef4bad83-742b-48ae-be73-e477c5b0aaae	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	4ac229bc-4227-46b0-9537-5c71b1749457	CREDIT	100	4120	4220	2026-08-18 18:47:14.793971
6d0a8a79-5245-465c-9a28-6b38793f6157	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	1bc2711c-2bf5-4bee-9af3-94d664fdcef7	CREDIT	100	4020	4120	2026-08-18 18:47:14.76555
8c297e4c-8470-4b28-8327-c7130ae43feb	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	6509d4ba-e43f-4548-bc3c-d03c5801e932	CREDIT	100	4020	4120	2026-08-18 18:47:14.774367
cfaf9b0d-8354-4b87-b2aa-e15941757682	cea18d24-b853-47db-b43c-f75bfc58c657	VERIFIED_PURCHASE	755f868f-f750-4d9c-8f6c-a7766a5c5b2f	CREDIT	100	4120	4220	2026-08-18 18:47:14.789083
dc9bf3ba-fe20-4d5b-9e11-334350a06648	3ef0cf37-b3b0-4524-99af-e75c5ddedda4	VERIFIED_PURCHASE	7646c3e1-eef0-4316-bfb0-cc6ade61cef2	CREDIT	15	0	15	2026-08-20 23:54:12.532486
5b4f3728-6398-4f81-8b8f-3736fe1ee14f	b519c600-c64b-4e7e-b305-c3d3f8625909	VERIFIED_PURCHASE	7646c3e1-eef0-4316-bfb0-cc6ade61cef2	CREDIT	15	0	15	2026-08-20 23:54:12.555521
6f1a8944-3387-400b-abbc-0272aeda7691	a91152b4-6f2b-450f-b50a-858f63015256	VERIFIED_PURCHASE	5dcb907c-c698-4263-b97e-c75754a52c18	CREDIT	15	0	15	2026-08-21 00:02:48.484969
102c36f0-7ac7-4e65-b289-ed06db3bcb13	3427f665-bbf0-4d58-a2be-67998bb4fb72	VERIFIED_PURCHASE	5dcb907c-c698-4263-b97e-c75754a52c18	CREDIT	15	0	15	2026-08-21 00:02:48.503126
9db616b8-34e4-4f4a-951f-78443a005199	8a6657ab-585f-40e4-ba97-1e405778913e	VERIFIED_PURCHASE	950dd011-95e4-4145-ae41-bf9ebc293d59	CREDIT	15	0	15	2026-08-21 00:04:07.699992
81d65dca-2716-4e98-a004-dff7b1247f77	8658bab4-4ea9-47c4-a1a5-641cc1186aa9	VERIFIED_PURCHASE	950dd011-95e4-4145-ae41-bf9ebc293d59	CREDIT	15	0	15	2026-08-21 00:04:07.716747
fd06fc23-cfb0-4026-97fe-91538e319cd1	a2c1bb86-b2cc-4372-868b-0ec32ae8ebd6	VERIFIED_PURCHASE	4a619c6f-7d1d-4a03-9aea-05eb2f27efdb	CREDIT	15	0	15	2026-08-21 00:08:58.42746
9caf80ba-3eaf-41d2-a787-229e9f8a2603	7394d087-c9fa-4b26-816c-963e76436cdd	VERIFIED_PURCHASE	4a619c6f-7d1d-4a03-9aea-05eb2f27efdb	CREDIT	15	0	15	2026-08-21 00:08:58.449854
655c6af1-052d-489e-b00d-254f65439ff2	9b1d6a5f-8403-41e9-b00a-defc89e8d1ce	VERIFIED_PURCHASE	75538b36-5d65-4e60-9cab-368725891b7b	CREDIT	15	0	15	2026-08-21 01:42:18.375145
5c583f27-2845-449a-99a5-a02e06b39d2d	a4da524f-d700-460f-899f-f586029fcbbb	VERIFIED_PURCHASE	75538b36-5d65-4e60-9cab-368725891b7b	CREDIT	15	0	15	2026-08-21 01:42:18.429559
8f465b17-9de7-416d-8d0c-9b26cce7db24	1eb9bd07-74d7-4a59-9cc3-2022697d0dc9	VERIFIED_PURCHASE	19a07ca0-5f8e-4e19-8a0d-1ebaa500b9ca	CREDIT	15	0	15	2026-08-21 01:47:43.772081
e606054e-8dcb-4139-ad24-80c548a4d00a	613853e7-2c80-4eee-948a-3f87b8c584dd	VERIFIED_PURCHASE	19a07ca0-5f8e-4e19-8a0d-1ebaa500b9ca	CREDIT	15	0	15	2026-08-21 01:47:43.79873
8b60d977-960a-485e-94e1-7e8663092caa	a6f877f4-e149-4193-9d31-ccc0912d658e	VERIFIED_PURCHASE	04c4aece-5e41-4314-a60f-9b95e2119b38	CREDIT	15	0	15	2026-08-21 02:05:52.640973
08927bc1-34e3-4870-a81e-167777edb118	d3bfb37f-c3c5-4bfe-9d66-06c17c79676c	VERIFIED_PURCHASE	04c4aece-5e41-4314-a60f-9b95e2119b38	CREDIT	15	0	15	2026-08-21 02:05:52.65022
f3693df0-1a72-4608-9074-b5de68518683	cb95e621-84a1-4c8b-baf2-5844d01b6c68	VERIFIED_PURCHASE	6aca4b47-133a-4ed2-9f41-4113643d64f1	CREDIT	15	0	15	2026-08-21 02:14:00.093795
11c79180-bbd3-41d5-8b83-dd69698b6b16	9bfbcb2f-e520-476b-8e82-931018b1b47a	VERIFIED_PURCHASE	6aca4b47-133a-4ed2-9f41-4113643d64f1	CREDIT	15	0	15	2026-08-21 02:14:00.103295
17815e18-655e-40b2-8184-f7b9df0eacdf	b569a72a-5c69-480d-b0a0-969984403432	VERIFIED_PURCHASE	eb6e9bd0-f65c-47d5-806d-5098e63560a1	CREDIT	15	0	15	2026-08-21 02:48:49.108434
7d923aa0-4920-4fcf-8784-01a7725cb9ce	312b5b6b-cb70-4e33-beab-a8f09d36ddcb	VERIFIED_PURCHASE	eb6e9bd0-f65c-47d5-806d-5098e63560a1	CREDIT	15	0	15	2026-08-21 02:48:49.130407
234194c2-465e-480b-b9c3-9724785eae45	02dd1c4f-62cf-4875-9652-a4eeb57d3e95	VERIFIED_PURCHASE	06cc9119-980b-478f-9bed-ad8652b9f457	CREDIT	15	0	15	2026-08-21 03:53:55.989857
7c287731-fcf6-4068-908e-83db4339daa4	d2ccf774-774e-41ac-ae16-ba498da0255a	VERIFIED_PURCHASE	06cc9119-980b-478f-9bed-ad8652b9f457	CREDIT	15	0	15	2026-08-21 03:53:56.01888
d2fd0bd1-8922-4a73-8bfe-7977f63be102	d4b499b3-abb8-472c-bf90-7da78198b2c9	VERIFIED_PURCHASE	6b1bed74-6364-4044-abe2-c01c12333e01	CREDIT	15	0	15	2026-08-21 04:16:14.746082
78b2251e-02e6-4e95-bfb3-7824bdbe28f9	a7d7095d-82e6-4e9a-9f8e-fa00f7ada7e4	VERIFIED_PURCHASE	6b1bed74-6364-4044-abe2-c01c12333e01	CREDIT	15	0	15	2026-08-21 04:16:14.765323
8f0bd49d-f5c9-4faa-87f7-03f00a1a22d3	a7d7095d-82e6-4e9a-9f8e-fa00f7ada7e4	VERIFIED_PURCHASE	0bd192ee-550f-477c-bdd5-ba890b037d48	CREDIT	15	15	30	2026-08-25 07:32:57.677434
a92e36bf-0a4e-47fa-9792-9c8cc1b920b1	f7169e39-6955-4dbc-ae99-da7f053ed741	VERIFIED_PURCHASE	0bd192ee-550f-477c-bdd5-ba890b037d48	CREDIT	15	0	15	2026-08-25 07:32:57.722077
6435cb9f-f884-4460-8895-2edca5bb87ef	d2ccf774-774e-41ac-ae16-ba498da0255a	VERIFIED_PURCHASE	39f14eb2-a16b-44fe-a546-2701fee2b128	CREDIT	15	15	30	2026-08-25 07:33:04.091975
931021b0-4c1e-4eb6-ad80-78912338ae39	f7169e39-6955-4dbc-ae99-da7f053ed741	VERIFIED_PURCHASE	39f14eb2-a16b-44fe-a546-2701fee2b128	CREDIT	15	15	30	2026-08-25 07:33:04.104777
8d3782ac-2157-45e0-80a1-205155a95fad	d4b499b3-abb8-472c-bf90-7da78198b2c9	VERIFIED_PURCHASE	3bd9cd15-19a2-4f7f-b974-fa021a537391	CREDIT	15	15	30	2026-08-25 08:01:25.568204
960e8779-dcf0-443b-8bf8-b7da7ca158d9	a7d7095d-82e6-4e9a-9f8e-fa00f7ada7e4	VERIFIED_PURCHASE	3bd9cd15-19a2-4f7f-b974-fa021a537391	CREDIT	15	30	45	2026-08-25 08:01:25.577889
80b7f6ce-50d4-433b-97ee-bad8dfab8c50	d4b499b3-abb8-472c-bf90-7da78198b2c9	VERIFIED_PURCHASE	f2d50405-4f64-44a5-9a00-27204c14af16	CREDIT	15	30	45	2026-08-25 08:01:47.253693
02fd34d2-4ede-4c8f-a4b6-870dd9a21a5f	a7d7095d-82e6-4e9a-9f8e-fa00f7ada7e4	VERIFIED_PURCHASE	f2d50405-4f64-44a5-9a00-27204c14af16	CREDIT	15	45	60	2026-08-25 08:01:47.263521
a7ba07f4-6acd-4de5-85e6-5e9190043dab	f7169e39-6955-4dbc-ae99-da7f053ed741	REDEMPTION_PRODUCT	9bfe4f32-bac3-4835-8db3-5b469e7d643c	DEBIT	3	30	30	2026-08-26 10:41:18.388444
a3d873b8-dfda-476a-9d00-56ee3b082d5b	f7169e39-6955-4dbc-ae99-da7f053ed741	VERIFIED_PURCHASE	2a8f1091-4b86-40f5-823b-d960af307d9a	CREDIT	12	30	42	2026-08-26 11:06:38.842465
5f884847-ab6e-4cf4-90f4-d30efefd7650	72a8f2a5-50c1-4f79-a16a-d9043a9a3f2f	VERIFIED_PURCHASE	2a8f1091-4b86-40f5-823b-d960af307d9a	CREDIT	12	0	12	2026-08-26 11:06:38.847466
bc5f2dc1-8afb-484e-a9e0-94b3e490f5e7	f7169e39-6955-4dbc-ae99-da7f053ed741	REDEMPTION_PRODUCT	9bfe4f32-bac3-4835-8db3-5b469e7d643c	DEBIT	3	42	39	2026-08-26 11:06:38.876203
81ee8b02-3e73-4398-9b2f-30c8de93515d	75c61916-8e03-4d71-adb7-8f53ad886682	VERIFIED_PURCHASE	f75aa49c-54fc-4ffc-af05-b9cd830fb17f	CREDIT	50	0	50	2026-08-26 13:26:42.429294
bdd888ca-f7a8-4498-bd9b-6a522ae869fa	046ad7b0-7480-4075-b983-697846d8b32d	VERIFIED_PURCHASE	f75aa49c-54fc-4ffc-af05-b9cd830fb17f	CREDIT	50	0	50	2026-08-26 13:26:42.444372
737ef7b8-13b0-46ba-a8e7-0f8eb67fa304	75c61916-8e03-4d71-adb7-8f53ad886682	VERIFIED_PURCHASE	75f17b78-4173-4b15-9dd1-a8f28a034796	CREDIT	50	50	100	2026-08-26 13:26:45.212762
a7a6f351-0d22-40cd-863e-cc38adee0bfc	046ad7b0-7480-4075-b983-697846d8b32d	VERIFIED_PURCHASE	75f17b78-4173-4b15-9dd1-a8f28a034796	CREDIT	50	50	100	2026-08-26 13:26:45.219656
9009989f-843b-4fb7-b232-df62a0a1090f	dbb0bb66-e789-4a70-a11f-5030e7f1073b	VERIFIED_PURCHASE	ebc14509-3a71-43fe-971b-c2dbab27a1dd	CREDIT	50	0	50	2026-08-26 13:28:15.28261
d936603a-de5f-4fff-89e9-2f80ffe2e7f1	17a820be-1bbe-4c8e-b626-45d6b73de925	VERIFIED_PURCHASE	ebc14509-3a71-43fe-971b-c2dbab27a1dd	CREDIT	50	0	50	2026-08-26 13:28:15.289536
829ffbdd-7509-4742-9e9b-33f55a63315a	dbb0bb66-e789-4a70-a11f-5030e7f1073b	VERIFIED_PURCHASE	9b785bbb-d17e-475a-adc1-ecfdf03d5539	CREDIT	50	50	100	2026-08-26 13:28:17.542535
060a44e5-a74f-4f7c-b3ec-15c6e7c0649e	17a820be-1bbe-4c8e-b626-45d6b73de925	VERIFIED_PURCHASE	9b785bbb-d17e-475a-adc1-ecfdf03d5539	CREDIT	50	50	100	2026-08-26 13:28:17.549222
88cb9a15-32f8-4910-b0e1-86ff97cb5596	4bc7b8e7-886c-4679-a154-8690228be918	VERIFIED_PURCHASE	543b33a5-c591-4275-a9ae-6d6add48ce50	CREDIT	50	0	50	2026-08-26 18:35:10.588269
4d127598-d8e1-4f68-b441-9f8e5506eb2b	eec2ecb0-5063-4ac1-a2d6-284209a1aded	VERIFIED_PURCHASE	543b33a5-c591-4275-a9ae-6d6add48ce50	CREDIT	50	0	50	2026-08-26 18:35:10.598379
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.product_images (id, business_id, product_id, url, file_name, sort_order, is_primary, created_at, variant_id) FROM stdin;
1c25e1b2-2dcd-4faa-8117-4bb871cdb177	13193bb5-b17f-4097-ba81-43005ad5c416	d2353df5-96fa-4636-a01d-d7503b30b9d3	/uploads/products/d2353df5-96fa-4636-a01d-d7503b30b9d3/fcfe078c-592a-415d-bebe-86903b8c114d.png	img1.png	1	t	2026-08-22 00:18:45.616646+00	\N
b33601cb-0063-4aab-9bbe-4352dc188417	13193bb5-b17f-4097-ba81-43005ad5c416	d2353df5-96fa-4636-a01d-d7503b30b9d3	/uploads/products/d2353df5-96fa-4636-a01d-d7503b30b9d3/cb3c3bf1-4088-4933-906d-efce2a1c043a.png	img2.png	2	f	2026-08-22 00:19:21.739805+00	\N
890f37ca-f6d8-41eb-92fd-6310037b8289	13193bb5-b17f-4097-ba81-43005ad5c416	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	/uploads/products/801e97f1-a26c-4e71-afbb-37ec3b2d6b22/c9208668-43e0-4b40-98e2-690f19dc96cc.png	b1.png	1	t	2026-08-22 00:42:57.144854+00	\N
2ee1efa3-7529-41e5-9aa3-20683013e195	13193bb5-b17f-4097-ba81-43005ad5c416	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	/uploads/products/801e97f1-a26c-4e71-afbb-37ec3b2d6b22/272b27d7-ad18-4d89-9b3f-b89ceac23593.png	b2.png	2	f	2026-08-22 00:42:57.199651+00	\N
50117654-0278-4f50-825d-4aa4f8ddd107	13193bb5-b17f-4097-ba81-43005ad5c416	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	/uploads/products/f16c3a8a-6a9a-4fa9-93c8-09c13cacf249/e9c57d23-efec-498e-a97c-8a8ebcac5a7c.png	b1.png	1	t	2026-08-22 00:45:15.790009+00	\N
4f26c105-e090-4592-8b88-940323ae9d7e	13193bb5-b17f-4097-ba81-43005ad5c416	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	/uploads/products/f16c3a8a-6a9a-4fa9-93c8-09c13cacf249/3da29af3-ff69-465e-b5a5-6c264f7926e1.png	b2.png	2	f	2026-08-22 00:45:15.842415+00	\N
4880c1b0-e967-4b45-95f7-6e5529101cbf	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	36a1ddfe-729b-45d8-bad3-c2166b88bff2	/uploads/products/36a1ddfe-729b-45d8-bad3-c2166b88bff2/421cbc22-f0a8-49a5-9b04-5ad1b5adafe3.jpg	shoes1.jpg	1	t	2026-08-22 01:04:21.697011+00	\N
fa216315-c1ac-4672-982e-70aa98ccb97f	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	36a1ddfe-729b-45d8-bad3-c2166b88bff2	/uploads/products/36a1ddfe-729b-45d8-bad3-c2166b88bff2/72d527c2-704d-4dd6-924f-2a9cca426de8.jpg	shoes.jpg	2	f	2026-08-22 01:04:21.711628+00	\N
1c7f5fb3-e5a2-4113-ad7b-65e9ceb0bf1c	13193bb5-b17f-4097-ba81-43005ad5c416	0597d6c0-7d34-40ad-b06e-cb917a6eff76	/uploads/products/0597d6c0-7d34-40ad-b06e-cb917a6eff76/309e3486-2e2d-4018-a307-592a58d94aaf.png	b1.png	1	t	2026-08-22 01:11:13.937992+00	\N
6fee585e-6dd5-480f-8274-fbd496e51f14	13193bb5-b17f-4097-ba81-43005ad5c416	0597d6c0-7d34-40ad-b06e-cb917a6eff76	/uploads/products/0597d6c0-7d34-40ad-b06e-cb917a6eff76/c54e0e27-699c-4929-91f7-8cb886eaea7f.png	b2.png	2	f	2026-08-22 01:11:13.998595+00	\N
a99ea78c-e0c5-4938-bec4-4fd5d3852b21	34f536ff-c14c-4a57-a933-930518d428e2	240989cd-66f6-45bd-ac81-62ea6ac175e4	/uploads/products/240989cd-66f6-45bd-ac81-62ea6ac175e4/f108ca6a-198a-42ce-a693-53ecfeaa5b2e.jpg	shoes1.jpg	1	t	2026-08-22 01:16:05.679464+00	\N
49dd6cf7-200d-4eae-b34a-f99aabf98150	34f536ff-c14c-4a57-a933-930518d428e2	240989cd-66f6-45bd-ac81-62ea6ac175e4	/uploads/products/240989cd-66f6-45bd-ac81-62ea6ac175e4/42b00f40-f16e-4939-87ae-7d8db7061d5d.jpg	shoes.jpg	2	f	2026-08-22 01:16:05.706604+00	\N
a4b5ada6-a662-4bbe-b01a-a8d00d5a40cd	13193bb5-b17f-4097-ba81-43005ad5c416	bf84c071-3b23-476b-aaa1-e517f76f583a	/uploads/products/bf84c071-3b23-476b-aaa1-e517f76f583a/6baf42cf-4cab-4f7f-94b9-1ceec8c6cf10.png	z.png	1	t	2026-08-22 01:23:12.885341+00	\N
835de08e-6bf4-4900-8713-0a33ed3e57d5	13193bb5-b17f-4097-ba81-43005ad5c416	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	/uploads/products/9f1beba7-30c2-4f13-8f2a-0127863a7ab5/e014bc92-ce19-4a30-8187-5b82e28704c3.png	b1.png	1	t	2026-08-22 01:23:37.49989+00	\N
a4cb0367-69fe-48a0-b14d-7a055c3eb4c8	13193bb5-b17f-4097-ba81-43005ad5c416	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	/uploads/products/9f1beba7-30c2-4f13-8f2a-0127863a7ab5/2ed4e0ef-44da-4773-b56b-b187219900c0.png	b2.png	2	f	2026-08-22 01:23:37.575193+00	\N
2957f5c3-32e7-4c3e-b513-480c54fbbd45	13193bb5-b17f-4097-ba81-43005ad5c416	51adcf0d-f636-4da2-8045-bf303f76ed0b	/uploads/products/51adcf0d-f636-4da2-8045-bf303f76ed0b/57cba56e-be9e-4db7-a34a-afc4803f50ff.png	b1.png	1	t	2026-08-22 01:30:30.455842+00	\N
771a74bb-6c09-444e-bbc6-194ea3ec2c21	13193bb5-b17f-4097-ba81-43005ad5c416	51adcf0d-f636-4da2-8045-bf303f76ed0b	/uploads/products/51adcf0d-f636-4da2-8045-bf303f76ed0b/4a5e8850-77ec-4df9-a5be-e528191082d4.png	b2.png	2	f	2026-08-22 01:30:30.519228+00	\N
64bb1bda-3919-4e27-a913-641a8d773bd3	13193bb5-b17f-4097-ba81-43005ad5c416	643f0184-bebd-4cd2-bdcf-23505d17b5d7	/uploads/products/643f0184-bebd-4cd2-bdcf-23505d17b5d7/1eda77f1-4ff3-4273-8b61-2a93538381ee.png	z.png	1	t	2026-08-22 01:30:46.63201+00	\N
a79fdc9a-6c3f-46ab-9b7d-62da706ae38b	34f536ff-c14c-4a57-a933-930518d428e2	2dec452a-7c11-4412-97e5-ad733e3bb0ff	/uploads/products/2dec452a-7c11-4412-97e5-ad733e3bb0ff/bfc992b7-a23e-4854-8905-606f27f551d4.jpg	beauty1.jpg	1	t	2026-08-25 11:53:32.232361+00	\N
85885825-4cdb-4fee-a309-4aa07d42fdca	34f536ff-c14c-4a57-a933-930518d428e2	2dec452a-7c11-4412-97e5-ad733e3bb0ff	/uploads/products/2dec452a-7c11-4412-97e5-ad733e3bb0ff/3266a9bd-3a6a-411f-9b7e-08cbe941ca67.jpg	beauty-lady1.jpg	2	f	2026-08-25 11:53:32.299959+00	\N
44040258-7bce-461b-ba67-00364de229c1	34f536ff-c14c-4a57-a933-930518d428e2	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	/uploads/products/9f21b16c-1b8d-4bfc-a4d0-31274095d6d3/69fb81ae-8e20-4773-be2b-e7c30c1e3131.png	ch2.png	1	t	2026-08-26 14:17:53.154211+00	\N
de54dc62-de2f-49f8-b52d-aea5bc00c968	34f536ff-c14c-4a57-a933-930518d428e2	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	/uploads/products/9f21b16c-1b8d-4bfc-a4d0-31274095d6d3/043ac690-d009-498c-bf23-50045287dfe8.png	cloth1child.png	2	f	2026-08-26 14:17:53.25245+00	\N
\.


--
-- Data for Name: product_review_aggregates; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.product_review_aggregates (product_id, average_rating, total_reviews, rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count, last_review_at, updated_at) FROM stdin;
497354c6-1272-48fd-b975-587a23f204e4	5.00	1	0	0	0	0	1	2026-08-26 22:58:03.292895+00	2026-08-26 22:58:03.642059+00
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.product_variants (id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status, created_at, updated_at) FROM stdin;
9589ca85-e475-4c94-989e-9c40a88cfd0e	cb69da3a-bef2-44aa-84c3-636df0200d81	SKU-045337	E2E T-Shirt	{}	0.00	0.00		PCS	ACTIVE	2026-08-21 03:53:42.287694+00	2026-08-21 03:53:42.287694+00
fec4d682-103b-41e8-90cc-ec40edd3e599	cb69da3a-bef2-44aa-84c3-636df0200d81	VAR-045337	Black / 42	{"Size": "42", "Color": "Black"}	15000.00	9000.00	BC045337	PCS	ACTIVE	2026-08-21 03:53:42.363417+00	2026-08-21 03:53:42.363417+00
91a9851b-fa50-4949-b766-f9ebd1cb3b96	cb69da3a-bef2-44aa-84c3-636df0200d81	VAR-RACE-045337	Race Variant	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 03:53:42.535752+00	2026-08-21 03:53:42.535752+00
754efde9-f55e-4767-a610-9a9619bf09a7	a92c35f3-5520-4269-b178-bc9cf568ba25	SKU-051556	E2E T-Shirt	{}	0.00	0.00		PCS	ACTIVE	2026-08-21 04:16:01.471471+00	2026-08-21 04:16:01.471471+00
693e071f-962d-482e-92b0-872d35d1586c	a92c35f3-5520-4269-b178-bc9cf568ba25	VAR-051556	Black / 42	{"Size": "42", "Color": "Black"}	15000.00	9000.00	BC051556	PCS	ACTIVE	2026-08-21 04:16:01.548671+00	2026-08-21 04:16:01.548671+00
1c15bd3a-b1bd-4279-a951-7eeae218315a	a92c35f3-5520-4269-b178-bc9cf568ba25	VAR-RACE-051556	Race Variant	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 04:16:01.831974+00	2026-08-21 04:16:01.831974+00
2fb94a7e-5e2b-4f3f-95bc-817befa89db6	8c1f8d4b-d0f7-46f5-8cfb-8d8cd344e43b	TV-55-4K-20260821125121	Smart LED 4K TV 55 Inch	{}	499.99	380.00		piece	ACTIVE	2026-08-21 11:51:28.21009+00	2026-08-21 11:51:28.21009+00
75e13a20-ebc4-4ded-84e0-3e5f041b7632	8c1f8d4b-d0f7-46f5-8cfb-8d8cd344e43b	TV-55-4K-BLK-20260821125121	55-inch Black Edition	{}	499.99	380.00		piece	ACTIVE	2026-08-21 11:51:28.531903+00	2026-08-21 11:51:28.531903+00
83dd387e-a22c-443f-a42f-7c6cb7722888	3004215d-01d4-49d4-97b6-5da83aad569d	TV-55-4K-20260821125341	Smart LED 4K TV 55 Inch	{}	499.99	380.00		piece	ACTIVE	2026-08-21 11:53:48.008346+00	2026-08-21 11:53:48.008346+00
1f61c123-ce27-463b-928b-53b21233b975	3004215d-01d4-49d4-97b6-5da83aad569d	TV-55-4K-BLK-20260821125341	55-inch Black Edition	{}	499.99	380.00		piece	ACTIVE	2026-08-21 11:53:48.335913+00	2026-08-21 11:53:48.335913+00
9111afff-56d9-4164-b4e7-e64fbc8027c7	f67232b9-af8b-434d-a175-477e009368e2	WH-20260821125423	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 11:54:28.603975+00	2026-08-21 11:54:28.603975+00
177ea894-762c-469a-b404-9e5dfe9347d1	f67232b9-af8b-434d-a175-477e009368e2	WH-BLK-20260821125423	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 11:54:28.61179+00	2026-08-21 11:54:28.61179+00
758628b2-2883-4e83-86e6-968ddf968714	b686a6eb-5ae0-496b-a720-0e76b80d2990	WH-20260821150246	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:02:57.690173+00	2026-08-21 14:02:57.690173+00
7234b66b-abbc-4dc6-96aa-ef89d965b36a	b686a6eb-5ae0-496b-a720-0e76b80d2990	WH-BLK-20260821150246	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:02:57.700567+00	2026-08-21 14:02:57.700567+00
2b40cf0f-8007-4d1a-8a06-ed15c8b1dacb	404e9442-0a60-4126-8ac6-24a6ec4beffe	WH-20260821150913	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:09:19.787616+00	2026-08-21 14:09:19.787616+00
33de05da-3de1-4d82-9c8e-e8e07e539f3e	404e9442-0a60-4126-8ac6-24a6ec4beffe	WH-BLK-20260821150913	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:09:19.7945+00	2026-08-21 14:09:19.7945+00
53bc8141-931c-4e52-a2d6-2eec64951893	c88211fc-ff19-4b63-aac0-378b6006accd	WH-20260821151022	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:10:27.898683+00	2026-08-21 14:10:27.898683+00
6581e9b3-4b01-4bcb-a6a9-e5a88836d46e	c88211fc-ff19-4b63-aac0-378b6006accd	WH-BLK-20260821151022	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:10:27.90225+00	2026-08-21 14:10:27.90225+00
f1986130-e3cc-4f99-8423-af714754acd9	bb0ec843-3988-4025-80c7-42da08bf647f	WH-20260821151259	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:13:07.154964+00	2026-08-21 14:13:07.154964+00
06c2f300-7e95-4ba3-baa4-edf438115a5d	bb0ec843-3988-4025-80c7-42da08bf647f	WH-BLK-20260821151259	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:13:07.160667+00	2026-08-21 14:13:07.160667+00
8f571bcc-316b-4e20-a4e8-21bb7af3c579	6810ebca-5c7e-4189-8418-a8b6b81096cb	WH-20260821151348	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:13:54.673369+00	2026-08-21 14:13:54.673369+00
6b083dfa-4c1a-4348-a10b-09b75402800a	6810ebca-5c7e-4189-8418-a8b6b81096cb	WH-BLK-20260821151348	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:13:54.678419+00	2026-08-21 14:13:54.678419+00
000ee09e-c19a-4be2-b362-4fdccadbfeff	a3de5bac-a9e5-4477-b8a2-401cf10aaca5	WH-20260821152742	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:27:48.501892+00	2026-08-21 14:27:48.501892+00
ce60c606-4b61-4229-90b3-edee744e95d1	a3de5bac-a9e5-4477-b8a2-401cf10aaca5	WH-BLK-20260821152742	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:27:48.510805+00	2026-08-21 14:27:48.510805+00
a92e86b1-488c-42a6-b4c6-2b879678ca46	65b6df58-93f5-434c-85c9-97eda93bcc2c	WH-20260821152845	Wireless Headphones	{}	50.00	30.00		piece	ACTIVE	2026-08-21 14:28:52.60723+00	2026-08-21 14:28:52.60723+00
d0d5a904-a30c-431b-b1fd-03a2a532fa2f	65b6df58-93f5-434c-85c9-97eda93bcc2c	WH-BLK-20260821152845	Black	{}	50.00	0.00		piece	ACTIVE	2026-08-21 14:28:52.613283+00	2026-08-21 14:28:52.613283+00
15d87612-9934-431c-87c5-d961fc4177a8	56fd557b-8d02-4cb4-afb9-7a46b5611838	BTMI-TSH-BLK-M	Black / M	{}	15000.00	9000.00		PCS	ACTIVE	2026-08-21 14:58:00.887005+00	2026-08-21 14:58:00.912668+00
67ac0e2d-2807-4e36-b628-5bb80171a4a0	56fd557b-8d02-4cb4-afb9-7a46b5611838	BTMI-TSH-BLK-L	Black / L	{}	15000.00	9000.00		PCS	ACTIVE	2026-08-21 14:58:00.927494+00	2026-08-21 14:58:00.927494+00
bc436e11-3196-439b-8e5d-8e1a3c0a2f4a	56fd557b-8d02-4cb4-afb9-7a46b5611838	BTMI-TSH-WHT-M	White / M	{}	16000.00	9500.00		PCS	ACTIVE	2026-08-21 14:58:00.943044+00	2026-08-21 14:58:00.943044+00
b7dbb717-98c7-47cf-8e13-11d1396c4682	b126a114-7182-4368-8aab-31521247e520	SMPL-STK-01	BTMI Simple Stock Product 20260821_234734	{}	2500.00	0.00		PCS	ACTIVE	2026-08-21 22:47:39.444483+00	2026-08-21 22:47:39.444483+00
d46c924b-699a-4f1d-b740-e02eefc1f4c5	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	TSH-BLK-M	Black / M	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 22:47:40.26201+00	2026-08-21 22:47:40.272095+00
074f6dc4-5507-4d0d-88ff-9c6506418dc3	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	TSH-BLK-L	Black / L	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 22:47:40.326749+00	2026-08-21 22:47:40.326749+00
46c25f23-409c-4b7b-8704-71cc503ca2eb	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	TSH-WHT-M	White / M	{}	16000.00	0.00		PCS	ACTIVE	2026-08-21 22:47:40.332527+00	2026-08-21 22:47:40.332527+00
a147e69f-8da5-4756-8497-023165884545	1e19a05a-0074-488a-999f-0b3fdc4ae92c	ZERO-STK	BTMI Zero Stock Product 1675	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 22:47:42.228725+00	2026-08-21 22:47:42.228725+00
088c22d5-b539-49a0-b902-15395dc6680f	17dcb70b-f466-4c0e-9661-d0d66d24a99e	SMPL-STK-01	BTMI Simple Stock Product 20260821_235954	{}	2500.00	0.00		PCS	ACTIVE	2026-08-21 23:00:01.496813+00	2026-08-21 23:00:01.496813+00
3e8d12fd-1095-443a-96b2-489b75e42172	e7ec9354-f20c-420c-a9be-7e74a8347718	TSH-BLK-M	Black / M	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:00:02.755949+00	2026-08-21 23:00:02.776893+00
764c1d2c-3f16-4152-9bbe-c7d4958bee95	e7ec9354-f20c-420c-a9be-7e74a8347718	TSH-BLK-L	Black / L	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:00:03.028758+00	2026-08-21 23:00:03.028758+00
318f9648-aa93-4875-ae58-3c5a201c2af9	e7ec9354-f20c-420c-a9be-7e74a8347718	TSH-WHT-M	White / M	{}	16000.00	0.00		PCS	ACTIVE	2026-08-21 23:00:03.037546+00	2026-08-21 23:00:03.037546+00
277fc325-dc11-43f4-930c-05e15e73c817	29d446fe-232d-4234-ab49-76ab2fc4ce9d	ZERO-STK	BTMI Zero Stock Product 9968	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 23:00:06.565489+00	2026-08-21 23:00:06.565489+00
c5705744-a9bf-4748-88c9-be7d52058c48	1fd17e3f-6d5f-40ce-938d-1d2ecb4cf30b	SMPL-STK-01	BTMI Simple Stock Product 20260822_000213	{}	2500.00	0.00		PCS	ACTIVE	2026-08-21 23:02:18.522639+00	2026-08-21 23:02:18.522639+00
d186f275-a10e-4da3-ab9e-93a5c39e7c41	0e30738e-1e1b-4be5-8329-f42679c3960c	TSH-BLK-M	Black / M	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:02:19.900737+00	2026-08-21 23:02:19.920613+00
624e2cdf-4dab-4b59-9c65-738fdf116353	0e30738e-1e1b-4be5-8329-f42679c3960c	TSH-BLK-L	Black / L	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:02:20.121043+00	2026-08-21 23:02:20.121043+00
7bd20943-b7d5-426f-a2f2-c98dd47643cc	0e30738e-1e1b-4be5-8329-f42679c3960c	TSH-WHT-M	White / M	{}	16000.00	0.00		PCS	ACTIVE	2026-08-21 23:02:20.130119+00	2026-08-21 23:02:20.130119+00
3acadb26-883d-463d-a875-91690d6b93cb	05584a9a-8580-44db-b0cb-9c2e96ca8ce4	ZERO-STK	BTMI Zero Stock Product 3016	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 23:02:23.546398+00	2026-08-21 23:02:23.546398+00
2121ddfa-cbe1-4bd0-8191-92c9e3dd996e	d6fd5969-db07-4457-b2fd-2eece6337fba	SMPL-STK-01	BTMI Simple Stock Product 20260822_000616	{}	2500.00	0.00		PCS	ACTIVE	2026-08-21 23:06:24.2209+00	2026-08-21 23:06:24.2209+00
f2eda4f3-fc5d-4c74-80b3-092403c42d09	95b682f1-307f-4142-b413-5e988f415a3f	TSH-BLK-M	Black / M	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:06:25.419199+00	2026-08-21 23:06:25.432076+00
1df5150e-af56-4819-b973-2ca810e8e76d	95b682f1-307f-4142-b413-5e988f415a3f	TSH-BLK-L	Black / L	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:06:25.513182+00	2026-08-21 23:06:25.513182+00
324c142f-f906-44fd-b28b-331b1afdcada	95b682f1-307f-4142-b413-5e988f415a3f	TSH-WHT-M	White / M	{}	16000.00	0.00		PCS	ACTIVE	2026-08-21 23:06:25.52001+00	2026-08-21 23:06:25.52001+00
9bb67538-a368-42b7-85ca-491d1cbb8881	d4e03e2b-45c1-4c8c-b62e-9756a4bd6a89	ZERO-STK	BTMI Zero Stock Product 3156	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 23:06:28.096484+00	2026-08-21 23:06:28.096484+00
237d1093-81ce-4d31-bbf7-72a9420b9303	40779f44-3065-4b9b-8b1a-c03db851d96d	SMPL-STK-01	BTMI Simple Stock Product 20260822_000826	{}	2500.00	0.00		PCS	ACTIVE	2026-08-21 23:08:34.864243+00	2026-08-21 23:08:34.864243+00
cd5234b0-21f9-4541-82e3-af6b44d2a3f7	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	TSH-BLK-M	Black / M	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:08:35.948134+00	2026-08-21 23:08:35.962733+00
ce9defdc-cf4f-4d1a-95a4-a6ed8d4d5fdb	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	TSH-BLK-L	Black / L	{}	15000.00	0.00		PCS	ACTIVE	2026-08-21 23:08:36.053973+00	2026-08-21 23:08:36.053973+00
36e87102-9405-4de7-b836-eeed5483b5b7	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	TSH-WHT-M	White / M	{}	16000.00	0.00		PCS	ACTIVE	2026-08-21 23:08:36.061608+00	2026-08-21 23:08:36.061608+00
98c0db23-02ee-4921-93df-72cf95be6fb7	a89660d6-b8b5-452f-ac9a-b22dbc2d5e25	ZERO-STK	BTMI Zero Stock Product 8487	{}	5000.00	0.00		PCS	ACTIVE	2026-08-21 23:08:38.711236+00	2026-08-21 23:08:38.711236+00
52aa22d4-ef94-4d95-921d-643517c28407	d2353df5-96fa-4636-a01d-d7503b30b9d3	BTC-CREAM-400	BTMI Beauty Test Cream	{"Volume": "400 ml", "Expiration Date": "2027-12-31"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 00:18:09.286339+00	2026-08-22 00:18:09.312819+00
af48f61a-fb4a-424a-b1df-daf72792421c	601bb78e-e450-4a02-b6e3-6d32d2b91647		Black / M	{"Size": "M", "Color": "Black"}	15000.00	0.00		PCS	ACTIVE	2026-08-22 00:18:09.562668+00	2026-08-22 00:18:09.571694+00
b149227d-9a59-4832-85ed-2f06435ef853	601bb78e-e450-4a02-b6e3-6d32d2b91647		Black / L	{"Size": "L", "Color": "Black"}	15000.00	0.00		PCS	ACTIVE	2026-08-22 00:18:09.576029+00	2026-08-22 00:18:09.576029+00
6addcdb7-adbc-4d0b-96ea-1516efdd4037	601bb78e-e450-4a02-b6e3-6d32d2b91647		White / M	{"Size": "M", "Color": "White"}	16000.00	0.00		PCS	ACTIVE	2026-08-22 00:18:09.596649+00	2026-08-22 00:18:09.596649+00
a6213ce1-3fd0-432d-963d-ea6ff404c55b	e6340d1c-60c7-4f28-a626-fecc0f511f71		BTMI Limete Only Juice	{}	5000.00	0.00		PCS	ACTIVE	2026-08-22 00:18:09.63401+00	2026-08-22 00:18:09.63401+00
8404132a-f171-4131-b3a7-829ad21c15ff	801e97f1-a26c-4e71-afbb-37ec3b2d6b22		BTMI Browser Cream — Light	{"Shade": "Light"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 00:42:57.070879+00	2026-08-22 00:42:57.084922+00
20dc2c86-3e17-4949-a3d2-152be599b766	801e97f1-a26c-4e71-afbb-37ec3b2d6b22		BTMI Browser Cream — Dark	{"Shade": "Dark"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 00:42:57.092353+00	2026-08-22 00:42:57.092353+00
a7a086ec-b66e-4452-a34e-972df4fcafa1	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249		BTMI Browser Cream — Light	{"Shade": "Light"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 00:45:15.704065+00	2026-08-22 00:45:15.723687+00
1c019546-3a02-4560-9027-7fab989def23	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249		BTMI Browser Cream — Dark	{"Shade": "Dark"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 00:45:15.731371+00	2026-08-22 00:45:15.731371+00
474f23b5-d9a8-4bde-8e9d-11b7e5159236	11bae456-e460-4c61-9f3d-81cf8fec8387		BTMI Temp Unpub	{}	3000.00	0.00		PCS	ACTIVE	2026-08-22 01:03:42.559125+00	2026-08-22 01:03:42.559125+00
1c129fea-e1e9-406a-bf0e-c1586bfae846	36a1ddfe-729b-45d8-bad3-c2166b88bff2		SOulier home mark nike	{"Color": "blue"}	10050.00	7976.00		5	ACTIVE	2026-08-22 01:04:21.619027+00	2026-08-22 01:04:21.636083+00
87e34596-a510-4615-82d4-27b244c804ca	0597d6c0-7d34-40ad-b06e-cb917a6eff76		BTMI Browser Cream — Light	{"Shade": "Light"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:11:13.832625+00	2026-08-22 01:11:13.854803+00
dd7cea02-4980-4d0e-ae08-3715b2c4f7a7	0597d6c0-7d34-40ad-b06e-cb917a6eff76		BTMI Browser Cream — Dark	{"Shade": "Dark"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:11:13.864168+00	2026-08-22 01:11:13.864168+00
e8cb2574-2c41-42b8-83e2-6e28ce6682e4	02b5836e-dbe7-4089-b2ff-f5c2210581f2		BTMI Zero Stock Probe	{}	4500.00	0.00		PCS	ACTIVE	2026-08-22 01:14:14.34197+00	2026-08-22 01:14:14.34197+00
c62fcde1-ff3b-4424-a621-5f509bae0163	240989cd-66f6-45bd-ac81-62ea6ac175e4		SOulier home mark nike	{"Size": "42", "Color": "blanc"}	7800.00	7000.00		PCS 4	ACTIVE	2026-08-22 01:16:05.578743+00	2026-08-22 01:16:05.612029+00
6966ff43-eacb-446d-9397-0a48c8d9df87	bf84c071-3b23-476b-aaa1-e517f76f583a		BTMI Fresh Probe Juice	{}	3500.00	0.00		PCS	ACTIVE	2026-08-22 01:23:12.784104+00	2026-08-22 01:23:12.816731+00
54f0758d-5169-455e-84f2-5beae07199e3	9f1beba7-30c2-4f13-8f2a-0127863a7ab5		BTMI Browser Cream — Light	{"Shade": "Light"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:23:37.367761+00	2026-08-22 01:23:37.409295+00
fb0a5c01-2aee-4364-9e78-56d445d4993f	9f1beba7-30c2-4f13-8f2a-0127863a7ab5		BTMI Browser Cream — Dark	{"Shade": "Dark"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:23:37.427276+00	2026-08-22 01:23:37.427276+00
61fcd4a0-2e23-4ed3-a803-02a212b9c409	51adcf0d-f636-4da2-8045-bf303f76ed0b		BTMI Browser Cream — Light	{"Shade": "Light"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:30:30.354968+00	2026-08-22 01:30:30.381797+00
6d207968-a153-4214-9312-a433410c8493	51adcf0d-f636-4da2-8045-bf303f76ed0b		BTMI Browser Cream — Dark	{"Shade": "Dark"}	8000.00	0.00		PCS	ACTIVE	2026-08-22 01:30:30.394757+00	2026-08-22 01:30:30.394757+00
445630d9-ab21-468f-be18-1e84dee2b63b	643f0184-bebd-4cd2-bdcf-23505d17b5d7		BTMI Fresh Probe Juice	{}	3500.00	0.00		PCS	ACTIVE	2026-08-22 01:30:46.56059+00	2026-08-22 01:30:46.577108+00
11111111-1111-1111-1111-111111111112	11111111-1111-1111-1111-111111111111	NIKE-TEST-SHOE-BLK-40	Black / 40	{"size": "40", "color": "Black"}	180000.00	120000.00		PCS	ACTIVE	2026-08-24 12:26:49.616871+00	2026-08-24 12:26:49.616871+00
11111111-1111-1111-1111-111111111113	11111111-1111-1111-1111-111111111111	NIKE-TEST-SHOE-WHT-41	White / 41	{"size": "41", "color": "White"}	180000.00	120000.00		PCS	ACTIVE	2026-08-24 12:26:49.616871+00	2026-08-24 12:26:49.616871+00
22222222-2222-2222-2222-222222222223	22222222-2222-2222-2222-222222222222	BEAUTY-CREAM-50ML-STD	50ml Standard	{"volume": "50ml"}	25000.00	15000.00		PCS	ACTIVE	2026-08-24 12:26:49.629296+00	2026-08-24 12:26:49.629296+00
593794ec-3686-47dd-a6f7-dbb18cd83944	22222222-2222-2222-2222-222222222222		XL	{}	25000.00	0.00		PCS	ACTIVE	2026-08-24 13:25:34.804438+00	2026-08-24 13:25:34.804438+00
346c2ac5-3291-4360-a240-f0b198c200a0	2dec452a-7c11-4412-97e5-ad733e3bb0ff		Makeup	{}	10000.00	14975.00		PCSm7	ACTIVE	2026-08-25 11:53:32.197466+00	2026-08-25 11:53:32.216047+00
c2e09d0e-35e0-41f4-809d-1806ea07a528	457e9f13-6371-4665-b3f0-42326e221624	SYNC-141718	Nike Test Shoe	{}	0.00	0.00		PCS	ACTIVE	2026-08-26 13:17:30.317613+00	2026-08-26 13:17:30.317613+00
1df9a7f9-a501-4c9e-baf7-6823233ac42d	457e9f13-6371-4665-b3f0-42326e221624	SYNC-V-141718	Black / 40	{"size": "40", "color": "Black"}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 13:17:30.347107+00	2026-08-26 13:17:30.347107+00
d7d8b1d8-3980-4e89-a725-4eaf5c7a160d	25bb1f32-b839-4350-ac1e-05f15bb9fadb	SYNC-141856	Nike Test Shoe	{}	0.00	0.00		PCS	ACTIVE	2026-08-26 13:19:07.170946+00	2026-08-26 13:19:07.170946+00
0d912723-82ba-424f-825c-d89cc055eff5	25bb1f32-b839-4350-ac1e-05f15bb9fadb	SYNC-V-141856	Black / 40	{"Size": "40", "Color": "Black"}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 13:19:07.194911+00	2026-08-26 13:19:07.194911+00
265fb6fe-a10e-4b3c-81cc-6a217dfe69f1	3633db86-a845-4652-a3a2-479204e9df3d	SYNC-142629	Nike Test Shoe	{}	0.00	0.00		PCS	ACTIVE	2026-08-26 13:26:41.060171+00	2026-08-26 13:26:41.060171+00
2edd16d1-d166-4042-869c-dc69c5ab0fee	3633db86-a845-4652-a3a2-479204e9df3d	SYNC-V-142629	Black / 40	{"Size": "40", "Color": "Black"}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 13:26:41.079734+00	2026-08-26 13:26:41.079734+00
7ca14eea-5140-41d1-8548-f02265b90b5b	1182341b-db96-45e6-8fae-ae5b86f7c5b0	SYNC-142802	Nike Test Shoe	{}	0.00	0.00		PCS	ACTIVE	2026-08-26 13:28:13.508156+00	2026-08-26 13:28:13.508156+00
8a34623a-177e-4ba9-8fda-e202569a2177	1182341b-db96-45e6-8fae-ae5b86f7c5b0	SYNC-V-142802	Black / 40	{"Size": "40", "Color": "Black"}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 13:28:13.525505+00	2026-08-26 13:28:13.525505+00
d3edb42b-e3d9-4750-b851-2b2483673301	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3		Baby's shirt	{"Color": "green"}	8000.00	12000.00		4	ACTIVE	2026-08-26 14:17:53.080483+00	2026-08-26 14:17:53.099261+00
ff36085b-ac18-4b81-80d8-6d5711a251d8	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3		xl	{}	8000.00	0.00		4	ACTIVE	2026-08-26 14:19:31.284217+00	2026-08-26 14:19:31.284217+00
e917c3a7-323a-4ff2-a697-47e7b29c5ba9	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3		S	{}	8000.00	0.00		4	ACTIVE	2026-08-26 14:20:01.381347+00	2026-08-26 14:20:01.381347+00
92a70582-c210-4b5f-a8ef-c578aa827f1a	59a5ada8-18fd-4944-8622-be244a516c29	SKU-162002-9511	Shoes Sync 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:09.369477+00	2026-08-26 15:20:09.369477+00
d8485982-b5c1-41a8-b202-faea034099c3	59a5ada8-18fd-4944-8622-be244a516c29	V-942673749	Black / 40	{"Color": "Black", "Material": "Mesh", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.382065+00	2026-08-26 15:20:09.382065+00
777d37dd-23bc-4150-b384-9c83261d0008	59a5ada8-18fd-4944-8622-be244a516c29	V-1241296690	Black / 41	{"Color": "Black", "Material": "Mesh", "Shoe Size": "41"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.411195+00	2026-08-26 15:20:09.411195+00
b1f8dbc3-0295-4332-8e7e-cf0d5f4e8e3b	59a5ada8-18fd-4944-8622-be244a516c29	V-1284821132	White / 40	{"Color": "White", "Material": "Mesh", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.424545+00	2026-08-26 15:20:09.424545+00
5a971890-6510-40d5-8eab-fa165506b0bd	59a5ada8-18fd-4944-8622-be244a516c29	V-261870297	White / 41	{"Color": "White", "Material": "Mesh", "Shoe Size": "41"}	51000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.439206+00	2026-08-26 15:20:09.439206+00
18af0d96-f118-49ed-9f39-e0aeff36ec14	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	SKU-162002-2306	Shoes3 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:09.618203+00	2026-08-26 15:20:09.618203+00
9536a714-88b2-44cc-9cd4-d6d91c17238a	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	V-1589428918	Black / 40	{"Color": "Black", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.624822+00	2026-08-26 15:20:09.624822+00
681c287e-98ca-403a-9b97-3fd968e2b485	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	V-2080004131	Black / 41	{"Color": "Black", "Shoe Size": "41"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.642556+00	2026-08-26 15:20:09.642556+00
c47d883a-c363-4056-bdd4-220797b73147	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	V-2053045119	White / 40	{"Color": "White", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.655471+00	2026-08-26 15:20:09.655471+00
f5c191c0-233d-4882-8125-0c0b7680914f	a5480f4b-675c-4c90-9b42-8171dd25b6b1	SKU-162002-4474	Food Sync 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:09.720103+00	2026-08-26 15:20:09.720103+00
6f4107cb-5d3a-4a9c-a110-87d35b8b75cf	a5480f4b-675c-4c90-9b42-8171dd25b6b1	V-364888582	Orange 500ml	{"Flavor": "Orange", "Volume": "500 ml", "Expiration Date": "2027-01-31"}	3000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.726361+00	2026-08-26 15:20:09.726361+00
c86c43ad-f134-4e88-8ca3-147750dda696	a5480f4b-675c-4c90-9b42-8171dd25b6b1	V-1775117565	Orange 1L	{"Flavor": "Orange", "Volume": "1 L", "Expiration Date": "2027-01-31"}	5000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.740554+00	2026-08-26 15:20:09.740554+00
9399d553-e713-47d2-8d7c-e1e963035493	a5480f4b-675c-4c90-9b42-8171dd25b6b1	V-1613548706	Mango 500ml	{"Flavor": "Mango", "Volume": "500 ml", "Expiration Date": "2027-01-31"}	3000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.755257+00	2026-08-26 15:20:09.755257+00
52357a84-cd46-4ade-a543-8ef7f792308a	a5480f4b-675c-4c90-9b42-8171dd25b6b1	V-287383572	Mango 1L	{"Flavor": "Mango", "Volume": "1 L", "Expiration Date": "2027-01-31"}	5000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.772088+00	2026-08-26 15:20:09.772088+00
6d836f47-cdc6-4ad3-9e57-7cb6eca49b29	50f14201-f49e-4211-b044-6c24f12eb48c	SKU-162002-7555	Elec Sync 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:09.838022+00	2026-08-26 15:20:09.838022+00
092005dc-8623-4e9e-9047-ca6e828ed017	50f14201-f49e-4211-b044-6c24f12eb48c	V-1195238086	128GB 8GB	{"RAM": "8GB", "Model": "Pro Max", "Storage": "128GB"}	800000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.844046+00	2026-08-26 15:20:09.844046+00
25c3aae5-7236-4e17-940f-3bc55856026e	50f14201-f49e-4211-b044-6c24f12eb48c	V-871459925	128GB 16GB	{"RAM": "16GB", "Model": "Pro Max", "Storage": "128GB"}	850000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.861017+00	2026-08-26 15:20:09.861017+00
804ba596-ce23-4623-8767-b63e6e1d5336	50f14201-f49e-4211-b044-6c24f12eb48c	V-1860369405	256GB 8GB	{"RAM": "8GB", "Model": "Pro Max", "Storage": "256GB"}	900000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.87584+00	2026-08-26 15:20:09.87584+00
d77217fa-d737-41df-920c-7a8349b32750	50f14201-f49e-4211-b044-6c24f12eb48c	V-1255446739	256GB 16GB	{"RAM": "16GB", "Model": "Pro Max", "Storage": "256GB"}	950000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.891048+00	2026-08-26 15:20:09.891048+00
bfaa29fb-90bf-4e51-aa93-34ef0cb511d4	950ad450-2f4f-4661-ba0d-d40cb7f57ae0	SKU-162002-9318	Simple Sync 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:09.957032+00	2026-08-26 15:20:09.957032+00
41f06336-be5b-489c-a0e3-d900d556ec9b	950ad450-2f4f-4661-ba0d-d40cb7f57ae0	V-1372208995	Default	{"Skin Type": "All Skin Types"}	15000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:09.962973+00	2026-08-26 15:20:09.962973+00
9de6e68b-619a-431d-ab45-a31b96477262	038981eb-f126-4009-a431-7a53744ecc07	SKU-162002-1035	Disc 162002	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:20:10.023377+00	2026-08-26 15:20:10.023377+00
429e9c2a-177b-4806-b6df-919cbe3e71ed	038981eb-f126-4009-a431-7a53744ecc07	V-57450037	Default	{"Skin Type": "Sensitive"}	20000.00	20000.00		PCS	ACTIVE	2026-08-26 15:20:10.028628+00	2026-08-26 15:20:10.028628+00
09cc9c96-4e97-4104-9db6-72b3e3d54998	709a4660-fd50-434c-8365-9f3c801d46a8	SKU-162119-1901	Shoes Sync 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:26.310573+00	2026-08-26 15:21:26.310573+00
8c381b27-8a7e-445a-a6ea-8b425cd00952	709a4660-fd50-434c-8365-9f3c801d46a8	V-1357016439	Black / 40	{"Color": "Black", "Material": "Mesh", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.327016+00	2026-08-26 15:21:26.327016+00
cd142b02-85b2-4368-8e3b-8f64e94214d1	709a4660-fd50-434c-8365-9f3c801d46a8	V-1230931906	Black / 41	{"Color": "Black", "Material": "Mesh", "Shoe Size": "41"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.346174+00	2026-08-26 15:21:26.346174+00
61c2f24b-3d22-4c1e-86ee-6df609e7f8fe	709a4660-fd50-434c-8365-9f3c801d46a8	V-578050644	White / 40	{"Color": "White", "Material": "Mesh", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.363549+00	2026-08-26 15:21:26.363549+00
7ceff9bf-8559-4caf-a3fc-473ff25bd585	709a4660-fd50-434c-8365-9f3c801d46a8	V-1347788533	White / 41	{"Color": "White", "Material": "Mesh", "Shoe Size": "41"}	51000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.383336+00	2026-08-26 15:21:26.383336+00
723e604d-afed-47cb-a0e2-6ce81079b396	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	SKU-162119-613	Shoes3 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:26.641681+00	2026-08-26 15:21:26.641681+00
17b9bb08-1fda-4d51-9740-7bc6020dfe83	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	V-588136428	Black / 40	{"Color": "Black", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.649356+00	2026-08-26 15:21:26.649356+00
52644af3-8fd7-4954-8073-3e2f40d1b920	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	V-1764998304	Black / 41	{"Color": "Black", "Shoe Size": "41"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.668555+00	2026-08-26 15:21:26.668555+00
0d8957e4-b643-4413-89e9-6d99e5772d7a	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	V-571827719	White / 40	{"Color": "White", "Shoe Size": "40"}	50000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.687186+00	2026-08-26 15:21:26.687186+00
3108f087-48c6-4ad7-98f8-4555ba2e2167	1441d588-bab7-4d95-9af7-6820a3ae4d28	SKU-162119-2406	Food Sync 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:26.746284+00	2026-08-26 15:21:26.746284+00
4735b867-63af-498f-a4e9-03a83354c007	1441d588-bab7-4d95-9af7-6820a3ae4d28	V-1030002431	Orange 500ml	{"Flavor": "Orange", "Volume": "500 ml", "Expiration Date": "2027-01-31"}	3000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.754694+00	2026-08-26 15:21:26.754694+00
4b853476-365c-48de-a269-e6a739b5b827	1441d588-bab7-4d95-9af7-6820a3ae4d28	V-1567443475	Orange 1L	{"Flavor": "Orange", "Volume": "1 L", "Expiration Date": "2027-01-31"}	5000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.776409+00	2026-08-26 15:21:26.776409+00
8ba6ce5f-a036-4bb1-be28-0fd14be45fc1	1441d588-bab7-4d95-9af7-6820a3ae4d28	V-296845889	Mango 500ml	{"Flavor": "Mango", "Volume": "500 ml", "Expiration Date": "2027-01-31"}	3000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.79268+00	2026-08-26 15:21:26.79268+00
96130975-fcfe-49cc-9dce-97fa8b7cb543	1441d588-bab7-4d95-9af7-6820a3ae4d28	V-1787514298	Mango 1L	{"Flavor": "Mango", "Volume": "1 L", "Expiration Date": "2027-01-31"}	5000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.812294+00	2026-08-26 15:21:26.812294+00
f93b2b7f-9ced-40e1-b3cc-c0148374579e	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	SKU-162119-7656	Elec Sync 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:26.904242+00	2026-08-26 15:21:26.904242+00
7021f3c7-e63c-4025-b499-4b7ee572dd10	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	V-940235671	128GB 8GB	{"RAM": "8GB", "Model": "Pro Max", "Storage": "128GB"}	800000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.912279+00	2026-08-26 15:21:26.912279+00
9bf786be-b399-4d16-83b5-bfb922e62f0b	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	V-1564345669	128GB 16GB	{"RAM": "16GB", "Model": "Pro Max", "Storage": "128GB"}	850000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.930873+00	2026-08-26 15:21:26.930873+00
6f7e2460-bcc3-48b8-b929-79dda417dcd8	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	V-115868505	256GB 8GB	{"RAM": "8GB", "Model": "Pro Max", "Storage": "256GB"}	900000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.949124+00	2026-08-26 15:21:26.949124+00
74138177-d61b-4931-a987-38d6053c2b5a	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	V-1014625729	256GB 16GB	{"RAM": "16GB", "Model": "Pro Max", "Storage": "256GB"}	950000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:26.96706+00	2026-08-26 15:21:26.96706+00
12086b8d-53d6-442b-8029-6a7f7b2c776e	3a758e49-51c7-4051-abd8-35f6d97d1137	SKU-162119-3998	Simple Sync 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:27.078015+00	2026-08-26 15:21:27.078015+00
91c2ed6b-ad4d-47fd-b750-04b50c9ce3a8	3a758e49-51c7-4051-abd8-35f6d97d1137	V-1621518984	Default	{"Skin Type": "All Skin Types"}	15000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:27.083889+00	2026-08-26 15:21:27.083889+00
7938c219-88e4-47c1-b63c-768a46e63e34	a783edfa-22cc-415b-8a83-487edb568366	SKU-162119-9273	Disc 162119	{}	50000.00	25000.00		PCS	ACTIVE	2026-08-26 15:21:27.243085+00	2026-08-26 15:21:27.243085+00
08f5d1ea-2a72-4de8-8476-b3d49a0cd198	a783edfa-22cc-415b-8a83-487edb568366	V-1188573525	Default	{"Skin Type": "Sensitive"}	20000.00	20000.00		PCS	ACTIVE	2026-08-26 15:21:27.252403+00	2026-08-26 15:21:27.252403+00
11145bb0-ede0-4981-b683-a8def97c26ef	497354c6-1272-48fd-b975-587a23f204e4		Running Shoe Test — Black / 40	{"Color": "Black", "Material": "Mesh", "Shoe Size": "40"}	25000.00	0.00		PCS	ACTIVE	2026-08-26 16:23:43.051651+00	2026-08-26 16:23:43.087279+00
53c0988a-3d96-453b-9546-69f83e16a29f	497354c6-1272-48fd-b975-587a23f204e4		Running Shoe Test — Black / 41	{"Color": "Black", "Material": "Mesh", "Shoe Size": "41"}	25000.00	0.00		PCS	ACTIVE	2026-08-26 16:23:43.094629+00	2026-08-26 16:23:43.094629+00
f292323e-9317-48e1-b4a4-26fbc3761b61	497354c6-1272-48fd-b975-587a23f204e4		Running Shoe Test — White / 40	{"Color": "White", "Material": "Mesh", "Shoe Size": "40"}	25000.00	0.00		PCS	ACTIVE	2026-08-26 16:23:43.102189+00	2026-08-26 16:23:43.102189+00
7a0796a7-424c-433c-a652-72316a0490f8	497354c6-1272-48fd-b975-587a23f204e4		Running Shoe Test — White / 41	{"Color": "White", "Material": "Mesh", "Shoe Size": "41"}	25000.00	0.00		PCS	ACTIVE	2026-08-26 16:23:43.109979+00	2026-08-26 16:23:43.109979+00
0103d08c-30a6-45e0-90fc-22b95970ced8	497354c6-1272-48fd-b975-587a23f204e4		XL	{"Color": "Black", "Material": "Mesh", "Shoe Size": "42"}	25000.00	0.00		PCS	ACTIVE	2026-08-26 17:04:24.660745+00	2026-08-26 17:06:14.436211+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.products (id, business_id, name, sku, description, unit_price, cost_price, unit, status, created_at, updated_at, publication_status, category_id, subcategory_id, discount_active, discount_type, discount_value, discount_start, discount_end) FROM stdin;
8c1f8d4b-d0f7-46f5-8cfb-8d8cd344e43b	bab467a1-e9e0-4ea3-a359-457abbd06c79	Smart LED 4K TV 55 Inch	TV-55-4K-20260821125121	Ultra HD 4K Android Smart TV	499.99	380.00	piece	ACTIVE	2026-08-21 11:51:28.199731+00	2026-08-21 11:51:28.199731+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
3004215d-01d4-49d4-97b6-5da83aad569d	50afee23-0ac7-4bbd-96b2-ec28eea43751	Smart LED 4K TV 55 Inch	TV-55-4K-20260821125341	Ultra HD 4K Android Smart TV	499.99	380.00	piece	ACTIVE	2026-08-21 11:53:48.004531+00	2026-08-21 11:53:48.004531+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
f67232b9-af8b-434d-a175-477e009368e2	53b8d3b9-f8dd-4337-8719-97edc9e449b5	Wireless Headphones	WH-20260821125423		50.00	30.00	piece	ACTIVE	2026-08-21 11:54:28.601723+00	2026-08-21 11:54:28.601723+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
b686a6eb-5ae0-496b-a720-0e76b80d2990	c87d9849-bca1-4328-abe3-793233aadf36	Wireless Headphones	WH-20260821150246		50.00	30.00	piece	ACTIVE	2026-08-21 14:02:57.6879+00	2026-08-21 14:02:57.6879+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
404e9442-0a60-4126-8ac6-24a6ec4beffe	b67bd1b2-d12a-486b-a287-82f120598b7c	Wireless Headphones	WH-20260821150913		50.00	30.00	piece	ACTIVE	2026-08-21 14:09:19.784796+00	2026-08-21 14:09:19.784796+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
c88211fc-ff19-4b63-aac0-378b6006accd	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	Wireless Headphones	WH-20260821151022		50.00	30.00	piece	ACTIVE	2026-08-21 14:10:27.89739+00	2026-08-21 14:10:27.89739+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
bb0ec843-3988-4025-80c7-42da08bf647f	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	Wireless Headphones	WH-20260821151259		50.00	30.00	piece	ACTIVE	2026-08-21 14:13:07.152982+00	2026-08-21 14:13:07.152982+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
6810ebca-5c7e-4189-8418-a8b6b81096cb	aacea673-e33b-4e03-9a1d-a59c899ac662	Wireless Headphones	WH-20260821151348		50.00	30.00	piece	ACTIVE	2026-08-21 14:13:54.671681+00	2026-08-21 14:13:54.671681+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
a3de5bac-a9e5-4477-b8a2-401cf10aaca5	704df200-1059-4f70-bfef-084c61675633	Wireless Headphones	WH-20260821152742		50.00	30.00	piece	ACTIVE	2026-08-21 14:27:48.499478+00	2026-08-21 14:27:48.499478+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
65b6df58-93f5-434c-85c9-97eda93bcc2c	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	Wireless Headphones	WH-20260821152845		50.00	30.00	piece	ACTIVE	2026-08-21 14:28:52.605406+00	2026-08-21 14:28:52.605406+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
b126a114-7182-4368-8aab-31521247e520	75c1e6d2-75f0-4116-88d4-ac684bda3c49	BTMI Simple Stock Product 20260821_234734	SMPL-STK-01		2500.00	0.00	PCS	ACTIVE	2026-08-21 22:47:39.440971+00	2026-08-21 22:47:39.440971+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
cb69da3a-bef2-44aa-84c3-636df0200d81	91eb7ec0-476f-41f3-9845-af89f864f129	E2E T-Shirt	SKU-045337	Cotton t-shirt for testing	0.00	0.00	PCS	ACTIVE	2026-08-21 03:53:42.276641+00	2026-08-21 03:53:42.309298+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	b1c4e813-b6c3-41b8-991f-d13fad541b35	f	NONE	0.00	\N	\N
fd0d403e-2cdd-4ac7-9aed-7aa41733274e	75c1e6d2-75f0-4116-88d4-ac684bda3c49	BTMI Stock Test T-Shirt	TSH-STOCK-TEST		15000.00	0.00	PCS	ACTIVE	2026-08-21 22:47:40.25946+00	2026-08-21 22:47:40.25946+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
1e19a05a-0074-488a-999f-0b3fdc4ae92c	75c1e6d2-75f0-4116-88d4-ac684bda3c49	BTMI Zero Stock Product 1675	ZERO-STK		5000.00	0.00	PCS	ACTIVE	2026-08-21 22:47:42.226411+00	2026-08-21 22:47:42.226411+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
17dcb70b-f466-4c0e-9661-d0d66d24a99e	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	BTMI Simple Stock Product 20260821_235954	SMPL-STK-01		2500.00	0.00	PCS	ACTIVE	2026-08-21 23:00:01.492905+00	2026-08-21 23:00:01.492905+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
e7ec9354-f20c-420c-a9be-7e74a8347718	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	BTMI Stock Test T-Shirt	TSH-STOCK-TEST		15000.00	0.00	PCS	ACTIVE	2026-08-21 23:00:02.753148+00	2026-08-21 23:00:02.753148+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
29d446fe-232d-4234-ab49-76ab2fc4ce9d	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	BTMI Zero Stock Product 9968	ZERO-STK		5000.00	0.00	PCS	ACTIVE	2026-08-21 23:00:06.56316+00	2026-08-21 23:00:06.56316+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
1fd17e3f-6d5f-40ce-938d-1d2ecb4cf30b	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	BTMI Simple Stock Product 20260822_000213	SMPL-STK-01		2500.00	0.00	PCS	ACTIVE	2026-08-21 23:02:18.515701+00	2026-08-21 23:02:18.515701+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
0e30738e-1e1b-4be5-8329-f42679c3960c	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	BTMI Stock Test T-Shirt	TSH-STOCK-TEST		15000.00	0.00	PCS	ACTIVE	2026-08-21 23:02:19.89816+00	2026-08-21 23:02:19.89816+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
05584a9a-8580-44db-b0cb-9c2e96ca8ce4	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	BTMI Zero Stock Product 3016	ZERO-STK		5000.00	0.00	PCS	ACTIVE	2026-08-21 23:02:23.544131+00	2026-08-21 23:02:23.544131+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
d6fd5969-db07-4457-b2fd-2eece6337fba	db8af7ab-c951-44ff-8445-0f2a4bad9b65	BTMI Simple Stock Product 20260822_000616	SMPL-STK-01		2500.00	0.00	PCS	ACTIVE	2026-08-21 23:06:24.216791+00	2026-08-21 23:06:24.216791+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
95b682f1-307f-4142-b413-5e988f415a3f	db8af7ab-c951-44ff-8445-0f2a4bad9b65	BTMI Stock Test T-Shirt	TSH-STOCK-TEST		15000.00	0.00	PCS	ACTIVE	2026-08-21 23:06:25.416825+00	2026-08-21 23:06:25.416825+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
d4e03e2b-45c1-4c8c-b62e-9756a4bd6a89	db8af7ab-c951-44ff-8445-0f2a4bad9b65	BTMI Zero Stock Product 3156	ZERO-STK		5000.00	0.00	PCS	ACTIVE	2026-08-21 23:06:28.092989+00	2026-08-21 23:06:28.092989+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
40779f44-3065-4b9b-8b1a-c03db851d96d	4c266dc8-d833-48bf-831f-fdf5b3e089b6	BTMI Simple Stock Product 20260822_000826	SMPL-STK-01		2500.00	0.00	PCS	ACTIVE	2026-08-21 23:08:34.860841+00	2026-08-21 23:08:34.860841+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
eb6f63a9-5671-47e5-90fe-8924d0c1b28c	4c266dc8-d833-48bf-831f-fdf5b3e089b6	BTMI Stock Test T-Shirt	TSH-STOCK-TEST		15000.00	0.00	PCS	ACTIVE	2026-08-21 23:08:35.945307+00	2026-08-21 23:08:35.945307+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
a89660d6-b8b5-452f-ac9a-b22dbc2d5e25	4c266dc8-d833-48bf-831f-fdf5b3e089b6	BTMI Zero Stock Product 8487	ZERO-STK		5000.00	0.00	PCS	ACTIVE	2026-08-21 23:08:38.709241+00	2026-08-21 23:08:38.709241+00	PUBLISHED	\N	\N	f	NONE	0.00	\N	\N
601bb78e-e450-4a02-b6e3-6d32d2b91647	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Test T-Shirt			15000.00	0.00	PCS	ACTIVE	2026-08-22 00:18:09.560313+00	2026-08-22 00:18:09.627258+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	\N	f	NONE	0.00	\N	\N
e6340d1c-60c7-4f28-a626-fecc0f511f71	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Limete Only Juice			5000.00	0.00	PCS	ACTIVE	2026-08-22 00:18:09.632496+00	2026-08-22 00:18:09.65033+00	PUBLISHED	1b94f540-a42b-4833-be2e-33ff44454be0	\N	f	NONE	0.00	\N	\N
d2353df5-96fa-4636-a01d-d7503b30b9d3	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Beauty Test Cream	BTC-CREAM-400	Test cream for flow verification	8000.00	0.00	PCS	ACTIVE	2026-08-22 00:18:09.281654+00	2026-08-22 00:32:21.625329+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Browser Cream		Created via real browser test	8000.00	0.00	PCS	ACTIVE	2026-08-22 00:45:15.700514+00	2026-08-22 00:45:15.877518+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
11bae456-e460-4c61-9f3d-81cf8fec8387	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Temp Unpub			3000.00	0.00	PCS	ACTIVE	2026-08-22 01:03:42.555937+00	2026-08-22 01:03:42.646067+00	DRAFT	2452f078-5c79-4dde-a7d4-1e9afab17bc9	\N	f	NONE	0.00	\N	\N
36a1ddfe-729b-45d8-bad3-c2166b88bff2	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	SOulier home mark nike		Chaussures Nike Air Max au design moderne et sportif, conçues pour offrir un bon confort au quotidien. Elles disposent d’une semelle amortissante, d’une tige respirante et d’une finition résistante adaptée à la marche, au sport léger et à une utilisation quotidienne. Disponibles en plusieurs couleurs et pointures selon le stock de la boutique.	10050.00	7976.00	5	ACTIVE	2026-08-22 01:04:21.616243+00	2026-08-22 01:04:21.721078+00	PUBLISHED	34ee875b-0c79-4eef-897d-dac1cd07cad1	b1c4e813-b6c3-41b8-991f-d13fad541b35	f	NONE	0.00	\N	\N
02b5836e-dbe7-4089-b2ff-f5c2210581f2	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Zero Stock Probe			4500.00	0.00	PCS	ACTIVE	2026-08-22 01:14:14.335221+00	2026-08-22 01:14:14.429195+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	\N	f	NONE	0.00	\N	\N
801e97f1-a26c-4e71-afbb-37ec3b2d6b22	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Browser Cream		Created via real browser test	8000.00	0.00	PCS	ACTIVE	2026-08-22 00:42:57.065022+00	2026-08-22 00:42:57.232272+00	DRAFT	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
a92c35f3-5520-4269-b178-bc9cf568ba25	60555b41-17c0-4214-8109-9c456e54c8ee	E2E T-Shirt	SKU-051556	Cotton t-shirt for testing	0.00	0.00	PCS	INACTIVE	2026-08-21 04:16:01.454983+00	2026-08-25 08:14:49.077442+00	DRAFT	34ee875b-0c79-4eef-897d-dac1cd07cad1	b1c4e813-b6c3-41b8-991f-d13fad541b35	f	NONE	0.00	\N	\N
56fd557b-8d02-4cb4-afb9-7a46b5611838	34f536ff-c14c-4a57-a933-930518d428e2	BTMI Stock Test T-Shirt	BTMI-TSH-STOCK	High quality cotton T-Shirt with initial stock test	15000.00	9000.00	PCS	INACTIVE	2026-08-21 14:58:00.883506+00	2026-08-26 11:21:13.764871+00	ARCHIVED	34ee875b-0c79-4eef-897d-dac1cd07cad1	ffc6c47c-9d4e-4908-9f26-23d7f239bf3a	f	NONE	0.00	\N	\N
240989cd-66f6-45bd-ac81-62ea6ac175e4	34f536ff-c14c-4a57-a933-930518d428e2	SOulier home mark nike		Le point qui me paraît particulièrement suspect après ton dernier refactor, c’est que le Seller crée maintenant un produit dans un contexte Shop, mais le Buyer Product Detail utilise peut-être encore une ancienne requête qui cherche seulement un product_id sans retrouver correctement l’offre/shop associé.	7800.00	7000.00	PCS 4	INACTIVE	2026-08-22 01:16:05.574391+00	2026-08-26 11:21:17.776679+00	ARCHIVED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f	NONE	0.00	\N	\N
643f0184-bebd-4cd2-bdcf-23505d17b5d7	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Fresh Probe Juice			3500.00	0.00	PCS	ACTIVE	2026-08-22 01:30:46.557414+00	2026-08-22 01:30:46.658238+00	PUBLISHED	1b94f540-a42b-4833-be2e-33ff44454be0	\N	f	NONE	0.00	\N	\N
50f14201-f49e-4211-b044-6c24f12eb48c	f25f43bd-ab50-4b87-b053-40a6af262d5b	Elec Sync 162002	SKU-162002-7555		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:09.836103+00	2026-08-26 15:20:09.908562+00	PUBLISHED	342aa21d-5919-4139-a189-3461ccc96c48	941f2664-f1e1-4d91-9072-d3aeb1a16d04	f		0.00	\N	\N
950ad450-2f4f-4661-ba0d-d40cb7f57ae0	f25f43bd-ab50-4b87-b053-40a6af262d5b	Simple Sync 162002	SKU-162002-9318		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:09.955261+00	2026-08-26 15:20:09.974134+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f		0.00	\N	\N
0597d6c0-7d34-40ad-b06e-cb917a6eff76	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Browser Cream		Created via real browser test	8000.00	0.00	PCS	ACTIVE	2026-08-22 01:11:13.828533+00	2026-08-22 01:11:14.094963+00	DRAFT	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
bf84c071-3b23-476b-aaa1-e517f76f583a	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Fresh Probe Juice			3500.00	0.00	PCS	ACTIVE	2026-08-22 01:23:12.776766+00	2026-08-22 01:23:12.968686+00	DRAFT	1b94f540-a42b-4833-be2e-33ff44454be0	\N	f	NONE	0.00	\N	\N
9f1beba7-30c2-4f13-8f2a-0127863a7ab5	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Browser Cream		Created via real browser test	8000.00	0.00	PCS	ACTIVE	2026-08-22 01:23:37.355463+00	2026-08-22 01:23:37.687371+00	DRAFT	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
51adcf0d-f636-4da2-8045-bf303f76ed0b	13193bb5-b17f-4097-ba81-43005ad5c416	BTMI Browser Cream		Created via real browser test	8000.00	0.00	PCS	ACTIVE	2026-08-22 01:30:30.351132+00	2026-08-22 01:30:30.609831+00	DRAFT	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f	NONE	0.00	\N	\N
11111111-1111-1111-1111-111111111111	13193bb5-b17f-4097-ba81-43005ad5c416	Nike Test Shoe	NIKE-TEST-SHOE	High performance athletic shoes with superior comfort and grip	180000.00	120000.00	PAIR	ACTIVE	2026-08-24 12:26:49.616871+00	2026-08-24 12:26:49.616871+00	PUBLISHED	55555555-5555-5555-5555-555555555555	\N	f	NONE	0.00	\N	\N
22222222-2222-2222-2222-222222222222	34f536ff-c14c-4a57-a933-930518d428e2	Beauty Cream	BEAUTY-CREAM-50ML	Nourishing facial beauty cream for smooth and radiant skin	25000.00	15000.00	PCS	ACTIVE	2026-08-24 12:26:49.629296+00	2026-08-24 12:26:49.629296+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	\N	f	NONE	0.00	\N	\N
2dec452a-7c11-4412-97e5-ad733e3bb0ff	34f536ff-c14c-4a57-a933-930518d428e2	Makeup		Crème de beauté hydratante pour le soin quotidien de la peau. Texture légère, agréable à appliquer et adaptée à une utilisation régulière.	10000.00	14975.00	PCSm7	ACTIVE	2026-08-25 11:53:32.188159+00	2026-08-25 11:53:32.336026+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	19a4b05d-8cef-4d82-bb1e-27524662145f	f	NONE	0.00	\N	\N
457e9f13-6371-4665-b3f0-42326e221624	224caa89-2d0c-405d-8e21-9a90071de100	Nike Test Shoe	SYNC-141718	sync e2e product	0.00	0.00	PCS	ACTIVE	2026-08-26 13:17:30.306749+00	2026-08-26 13:17:30.306749+00	DRAFT	\N	\N	f		0.00	\N	\N
25bb1f32-b839-4350-ac1e-05f15bb9fadb	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	Nike Test Shoe	SYNC-141856	sync e2e product	0.00	0.00	PCS	ACTIVE	2026-08-26 13:19:07.168972+00	2026-08-26 13:19:07.180252+00	PUBLISHED	\N	\N	f		0.00	\N	\N
3633db86-a845-4652-a3a2-479204e9df3d	f5bbc830-34b8-45a0-b50d-b16b0a362689	Nike Test Shoe	SYNC-142629	sync e2e product	0.00	0.00	PCS	ACTIVE	2026-08-26 13:26:41.056265+00	2026-08-26 13:26:41.070442+00	PUBLISHED	\N	\N	f		0.00	\N	\N
1182341b-db96-45e6-8fae-ae5b86f7c5b0	1ba51d3e-52e7-40ec-878d-55a7d135bdad	Nike Test Shoe	SYNC-142802	sync e2e product	0.00	0.00	PCS	ACTIVE	2026-08-26 13:28:13.505728+00	2026-08-26 13:28:13.516568+00	PUBLISHED	\N	\N	f		0.00	\N	\N
9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	34f536ff-c14c-4a57-a933-930518d428e2	Baby's shirt		this made for youth under heat season	8000.00	12000.00	4	ACTIVE	2026-08-26 14:17:53.073348+00	2026-08-26 14:17:53.280333+00	PUBLISHED	e2492a82-8005-467f-af8e-e352caf26067	e642cd51-4186-42c7-9d0e-0211b47f2b90	f		0.00	\N	\N
59a5ada8-18fd-4944-8622-be244a516c29	f25f43bd-ab50-4b87-b053-40a6af262d5b	Shoes Sync 162002	SKU-162002-9511		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:09.362541+00	2026-08-26 15:20:09.453346+00	PUBLISHED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f		0.00	\N	\N
f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	f25f43bd-ab50-4b87-b053-40a6af262d5b	Shoes3 162002	SKU-162002-2306		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:09.615917+00	2026-08-26 15:20:09.666852+00	PUBLISHED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f		0.00	\N	\N
a5480f4b-675c-4c90-9b42-8171dd25b6b1	f25f43bd-ab50-4b87-b053-40a6af262d5b	Food Sync 162002	SKU-162002-4474		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:09.717814+00	2026-08-26 15:20:09.785662+00	PUBLISHED	1b94f540-a42b-4833-be2e-33ff44454be0	2c981f12-e64b-491a-b2db-7a9a4bf7d310	f		0.00	\N	\N
038981eb-f126-4009-a431-7a53744ecc07	f25f43bd-ab50-4b87-b053-40a6af262d5b	Disc 162002	SKU-162002-1035		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:20:10.021591+00	2026-08-26 15:20:10.040239+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f		0.00	\N	\N
709a4660-fd50-434c-8365-9f3c801d46a8	65a47cfd-4a86-4a1c-beab-63c72c97747c	Shoes Sync 162119	SKU-162119-1901		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:26.308147+00	2026-08-26 15:21:26.443292+00	PUBLISHED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f		0.00	\N	\N
4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	65a47cfd-4a86-4a1c-beab-63c72c97747c	Shoes3 162119	SKU-162119-613		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:26.639802+00	2026-08-26 15:21:26.707582+00	PUBLISHED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f		0.00	\N	\N
1441d588-bab7-4d95-9af7-6820a3ae4d28	65a47cfd-4a86-4a1c-beab-63c72c97747c	Food Sync 162119	SKU-162119-2406		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:26.744875+00	2026-08-26 15:21:26.830183+00	PUBLISHED	1b94f540-a42b-4833-be2e-33ff44454be0	2c981f12-e64b-491a-b2db-7a9a4bf7d310	f		0.00	\N	\N
d5137c00-0349-4e09-a9e3-bfbae3bfa44e	65a47cfd-4a86-4a1c-beab-63c72c97747c	Elec Sync 162119	SKU-162119-7656		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:26.902566+00	2026-08-26 15:21:27.002657+00	PUBLISHED	342aa21d-5919-4139-a189-3461ccc96c48	941f2664-f1e1-4d91-9072-d3aeb1a16d04	f		0.00	\N	\N
3a758e49-51c7-4051-abd8-35f6d97d1137	65a47cfd-4a86-4a1c-beab-63c72c97747c	Simple Sync 162119	SKU-162119-3998		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:27.076124+00	2026-08-26 15:21:27.102215+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f		0.00	\N	\N
a783edfa-22cc-415b-8a83-487edb568366	65a47cfd-4a86-4a1c-beab-63c72c97747c	Disc 162119	SKU-162119-9273		50000.00	25000.00	PCS	ACTIVE	2026-08-26 15:21:27.237738+00	2026-08-26 15:21:27.283438+00	PUBLISHED	2452f078-5c79-4dde-a7d4-1e9afab17bc9	13a9f6ca-0e02-4106-a34b-0f0674b56e9b	f		0.00	\N	\N
497354c6-1272-48fd-b975-587a23f204e4	28158bd6-cd39-49a8-a0a9-58ec324473bc	Running Shoe Test			25000.00	0.00	PCS	ACTIVE	2026-08-26 16:23:43.02628+00	2026-08-26 16:23:43.186774+00	PUBLISHED	55555555-5555-5555-5555-555555555555	66666666-6666-6666-6666-666666666666	f		0.00	\N	\N
\.


--
-- Data for Name: purchase_confirmations; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.purchase_confirmations (id, order_id, buyer_profile_id, cash_payment_id, confirmed_at, created_at) FROM stdin;
4a8f26f6-959b-4f4a-a430-bbdc50eb6613	0bd192ee-550f-477c-bdd5-ba890b037d48	cfa4847c-bc06-4f1a-8791-c96d71b61579	4bc22288-ff85-491c-8ed7-59dbffe06337	2026-08-25 07:32:57.631659	2026-08-25 07:32:57.631659
fb389d83-482d-498f-b82b-d49804a8ddc8	39f14eb2-a16b-44fe-a546-2701fee2b128	cfa4847c-bc06-4f1a-8791-c96d71b61579	702f116a-a6af-4dcf-ae94-4a57f539f142	2026-08-25 07:33:04.072317	2026-08-25 07:33:04.072317
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.refresh_tokens (id, user_id, token_hash, user_agent, ip_address, created_at, expires_at, revoked_at) FROM stdin;
48253e92-9045-43be-bef1-4c3025adb57e	10f488ae-e546-407e-ad82-96efb18466c6	e5bb3e6e1696ab225d2e404c65f23eba64d61d1c7a500e5dd74def5f2c7a5255	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 10:45:30.126659+00	2026-08-28 10:45:30.126658+00	2026-08-21 11:08:46.522195+00
ee1235f3-8b27-4bf3-997b-4bfc97abac82	4ad3d1d8-8224-48e3-a15f-efd114544a97	46e902384556bdc906ae19a6b8c685630bd192b4efce1c3da85d12ec370e5fae	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:53:41.546936+00	2026-08-28 03:53:41.546891+00	2026-08-21 03:53:41.702019+00
05134578-f9e8-4b5e-9f0c-fc04e5805e96	4ad3d1d8-8224-48e3-a15f-efd114544a97	1ae85196581483c8a0cfe5f6658edf83dbd92183f021492fa78ddba3237c2986	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:53:41.705349+00	2026-08-28 03:53:41.705348+00	\N
7a93bd49-007d-4358-b727-533cabb331b2	1a71c2be-c812-4d18-8291-e8cc3b43e017	e5c7cebecd4e56a565e892a3469ca8c0683ea43c063e5e9c6e339144a8820ac9	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:53:52.960001+00	2026-08-28 03:53:52.959997+00	\N
6c239675-1b20-487a-baef-45be8672985d	6ef27787-11f2-4de0-960f-c5d9308d0e28	2f8db37ce280e4d195c309fc7f014ddb114d840202ce85513f3b8f46a8d379cb	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:53:54.389922+00	2026-08-28 03:53:54.38992+00	\N
6f811a53-7ea5-491f-9d0c-e1af51a5c0b5	9fbf0cc2-ae16-45fb-a3e0-7fc1db4b4bc7	0a9b4edb687c5a31d384fa05d1a400294a8cd8a69a81c9c355b24a448e315da9	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:53:55.34192+00	2026-08-28 03:53:55.341917+00	\N
7e501d33-2d3d-42ca-b246-2602d5f68b48	00c2d92b-4a5a-4000-b15b-a888d217f4c9	fdec68cdc32b767f53fc7adcac53d997825bdd71116fc8289d96a5b7345083b0	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 04:16:00.520361+00	2026-08-28 04:16:00.520284+00	2026-08-21 04:16:00.744812+00
240dec83-477c-40e5-8491-89f8534cc290	00c2d92b-4a5a-4000-b15b-a888d217f4c9	f3465826b924c5611dc296067d196944a1011155e8eb3a1e0f7e89eb6b68588c	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 04:16:00.746772+00	2026-08-28 04:16:00.74677+00	\N
8c524ba4-d293-4802-96b9-e56a91d38a81	ddabcdf3-c71d-4b0a-8493-96ee7f68bdc9	95a28df7ee921a7d71b2c3fe2f5a47366cab66a931f7f1fcbc3982b21555e20a	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 04:16:12.139303+00	2026-08-28 04:16:12.139301+00	\N
0d1d55ef-c912-422f-87e0-9fbf80fa14ca	a64886eb-19bc-49fd-9fc6-d2090eec44ed	8e635a9a3a1ee22a07479f583c79a3497f6eef7daa163841f472516a7b4e86ff	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 04:16:13.171414+00	2026-08-28 04:16:13.171412+00	\N
f59c9abf-84e5-48e1-ad9e-14ba518b5a2f	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	c6ce439ef9da0756bafb45f934d9406e4243b6d7dd6cf2f1980f1117268b3b10	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 04:16:13.999037+00	2026-08-28 04:16:13.999035+00	\N
6100f43c-5d69-499b-8177-00cbe186080b	96bee62f-1d2c-4714-86d4-20f96a6cc661	39565609429b8a3d67854d171504c257eef8a88e441e3a8a39ae0df1e6fd2315	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-21 04:27:44.088769+00	2026-08-28 04:27:44.088768+00	\N
f89fcefa-9b95-4c7c-b327-186b8e4a559a	10f488ae-e546-407e-ad82-96efb18466c6	a1b4e85df7e480e66e8f6c3caddbefce1c5b2387a6081fa4e493a534a8892e1e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 10:36:46.925084+00	2026-08-28 10:36:46.925082+00	\N
ac874bb6-c9c6-4791-97c0-2f151a8bb37f	10f488ae-e546-407e-ad82-96efb18466c6	255089338b322d5ba0ed396400491476a1edc73b0e586d78c8d42a02bcb7a944	curl/8.21.0	172.18.0.1	2026-08-21 10:39:44.189063+00	2026-08-28 10:39:44.189061+00	\N
05404645-d8f9-4557-9762-2a27862453b4	10f488ae-e546-407e-ad82-96efb18466c6	795e484380f38d944d8ee3e1a62e8b99aa2da376c0eab2223720632b139c7605	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 10:45:12.667311+00	2026-08-28 10:45:12.667283+00	\N
c20110c5-bda7-4412-8a9f-e2e00828b655	10f488ae-e546-407e-ad82-96efb18466c6	9b3e447d4dd8a6a10d8b609eb5b09ea5d2f47059758173fd3b317ccc010ba632	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 10:45:13.745096+00	2026-08-28 10:45:13.745095+00	\N
cd970433-742a-49d4-abd0-90ad4d98b56c	d6c335ec-c9ab-412e-b8b8-ccaa707d6459	a2cff4a2046c4416b1022dd747913a5c2913361991d61781ba159542dc0946b9	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:22:01.720918+00	2026-08-28 11:22:01.720915+00	\N
103bdf2a-85a2-47cb-a938-4b0166dd5b57	f827bb2d-a0de-44d5-bc8b-2420eb649399	04a7f660260cfe5e79b1d159fea691d684f31b051b79eb6005b73bf2a4746afd	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:22:08.457249+00	2026-08-28 11:22:08.457246+00	\N
8f64ebff-bf29-4074-8bb0-b6b82566059d	161b2af3-20d7-48f9-8a93-f1955402178c	d255262e72731fc0f2f611ee65831661a1f4332ef4e382506ff658e2d5b7be09	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:22:42.728254+00	2026-08-28 11:22:42.728253+00	\N
31d018ba-7289-4729-a7d1-ff41d069e1d6	1b928f7c-b6a7-4068-a392-d4f3f51fc93b	a7e3603a9332e87b4b1e40af1616d99eb99388bc67b9ceead8ec4c7886449cc3	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:23:37.559232+00	2026-08-28 11:23:37.559229+00	\N
b9b90056-0c01-4464-841a-bae80d5b824c	76d852b2-31fd-42a0-a775-499b1e547358	d766980846480f595680cf77636c5cd60daba636bf1ba5fa8450e21cee6eac16	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:24:34.125233+00	2026-08-28 11:24:34.125231+00	\N
3cb8635e-7787-4cb0-9f9c-1da6387a35f2	10f488ae-e546-407e-ad82-96efb18466c6	8033ab3029829afc295683489ab2f2e5e6593b345d6c09e1af8eea984e99a896	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 11:08:46.528289+00	2026-08-28 11:08:46.528287+00	2026-08-21 11:25:47.07358+00
0a8a3ef3-e2b3-43ac-9048-20204103c068	88810add-fec9-4976-88bb-733ba17081c9	e72edfc47e1426e34dc3bdc889c865745e8992d0c4d469d8b79c6edf47285ea7	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:33:23.738406+00	2026-08-28 11:33:23.738403+00	\N
89c3515d-d212-4188-85b1-279269f1b1ea	0dd0cece-b905-49f5-a3e5-15a72cc42d19	c80753830c6c9a03958d44ae6377f8df0f5843aede6b4f583ae131f57db66dd7	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:33:28.953649+00	2026-08-28 11:33:28.953646+00	\N
c1d51006-a83a-4d28-8345-7fcc208251b2	d7f02ea1-97ab-443a-b162-4ff931ca2a25	3b2428a181da9f3cd491adabbd5ac60c7253f1708f35e5494b708afb463d531b	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:33:33.568759+00	2026-08-28 11:33:33.568757+00	\N
9a8894c5-ff39-46d0-bda6-81b52b6f316a	10f488ae-e546-407e-ad82-96efb18466c6	f88fcb2717eda025c007b5dfc4599646e54a9a9def7bfa34188e942a64952ce2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 11:25:47.07607+00	2026-08-28 11:25:47.076068+00	2026-08-21 11:41:08.732969+00
b12b7895-7d34-4cde-8110-e84a55e24d28	a0de438d-d002-40e3-bbf8-4f6db93d2806	80847e43252eede8b2eea900cf335c75f86a79c253ae140177c90a8422736c8e	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:51:26.988723+00	2026-08-28 11:51:26.988721+00	\N
53d686cf-c48e-4529-8abb-36090f80807d	deff6045-e0b5-4005-8333-9c22e88edc61	586928f0e7758d86c3dc09ceeec0ef2c0d1ae510472b82f7495ed87223b37e36	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:53:46.506051+00	2026-08-28 11:53:46.506049+00	\N
5a6a9bfd-66dd-4d1a-9e5e-e211b3b1dd55	10f488ae-e546-407e-ad82-96efb18466c6	a7617ccc03033ce2ff763ef808b7b9d4be96aea79b618ad84373a013aba2a872	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 11:41:08.734578+00	2026-08-28 11:41:08.734577+00	2026-08-21 14:11:26.736613+00
8cabad03-5205-4f13-9249-513408f10d78	10f488ae-e546-407e-ad82-96efb18466c6	5ed51526daca158655c69443578a01539d4aaec3c85d5def477c2f7cedd42985	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-21 11:11:30.09235+00	2026-08-28 11:11:30.092347+00	2026-08-21 14:30:24.221991+00
da6cbe2d-9ce5-4524-bed1-605a5591e732	2b453813-5644-4fde-b134-d2bc067987a9	9b4c721fccfb3a979ab37bf56b246d135284e9fdc2fc15b18bad5e9150d3c81e	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 03:04:47.864363+00	2026-08-28 03:04:47.864359+00	2026-08-26 10:33:43.653476+00
f77218cf-e4b2-4782-8a14-053db0382ab0	e271741f-799d-49b0-ac63-8e382d67fc6c	b15ca57434e7847dffb731b1eb7cb961dde0ecdbd92211a3058af6d6aec1ad5f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:54:28.557135+00	2026-08-28 11:54:28.557133+00	\N
7f4dcb53-5a88-486f-b8f8-b163852ce1b2	54721785-d2ea-42a3-9b02-c89c13f72777	f55d1f67822c1eb43a0dfacbb732bb4cf98c390fa860c11225e1d19be47928fd	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 11:54:32.911346+00	2026-08-28 11:54:32.911342+00	\N
0ee6ed21-399d-4fc7-a5b7-6c1e0f2dcf9d	dec18fe0-92d5-4faf-98db-9c5d615fdace	a22ad8aa922cff689b938091e291c13696dc50f760904ae0a65c5a77153e6b29	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:02:57.657968+00	2026-08-28 14:02:57.657967+00	\N
a25899ce-1e76-40ff-955a-509728a17b5f	fe4af24e-8a53-4d72-a56c-5bb51b5937bc	ec355649e9f37ce5d9fed4938f65ae7a364998c07c71da834f2c9a33d462a188	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:03:02.686267+00	2026-08-28 14:03:02.686266+00	\N
6e1c8d20-ee0e-4c2c-9f71-216249ad9b6d	dae3304d-d7b9-46e0-adb4-0f7b023a9500	460ea84a9c2862e13d40340aba0d46da98cdde2fa159f22d11caf54b5775d681	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:09:19.759928+00	2026-08-28 14:09:19.759925+00	\N
9c48a7c7-1403-47d8-bf68-d065b88651c2	2f7f19dc-5d38-4642-a3d8-4c1ed2e11d8c	2da990580fbc2813d1d536f41a56f342447d1fb6d34cdb6e7574b3595d0e5ae1	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:09:25.557388+00	2026-08-28 14:09:25.557386+00	\N
e2d060c6-cbd0-4abf-b882-559fc7a0e3f5	c18774e1-d8f5-40f5-8582-f2b9b55912e7	8a59831c9be19869bfa07928c9d3f1d4096d307e950bad3ab2ab232e5ec116c6	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:10:27.880091+00	2026-08-28 14:10:27.88009+00	\N
f0092f95-06d5-46b5-ac0b-8e97f9920049	ad91281f-138a-411c-ada1-8d11f4625237	6859790f252a669e2cc6f9a8d528fcb39742daedb150c37b37ab593e0667ac00	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:10:33.147982+00	2026-08-28 14:10:33.147981+00	\N
a360e82e-6057-48bf-9c9b-bfc0da683e1f	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	7a4d091eba23ea2edb3aebd114f3df86846a77144093b85acfc0520d05b621d9	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:13:07.13217+00	2026-08-28 14:13:07.132169+00	\N
9df6d839-56e5-47a2-925b-3057a2acb08d	79684130-93c3-44c7-a9c9-b3c313449da5	35cd7acb5ead84ee98561912f38c19775d58ec29485d986051c8990d08427266	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:13:13.714533+00	2026-08-28 14:13:13.714532+00	\N
9ea3917f-4913-44c8-881a-202a7ec21b59	d31867cb-cc3e-49c6-ba4c-04d10901255b	5743045704f2ba6f1537cbc58373deb63a3d84d74108c035cd93d44b29d839cb	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:13:54.65037+00	2026-08-28 14:13:54.650365+00	\N
29690ba7-ab49-4e9e-9872-b58b2faa59cd	fea3d9d4-bb12-4a43-8d31-347af8c4e20d	c1cc62e70bfc508a83218a43f1ec48ab8316acd991a3a47593c754a6ff1d1623	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:14:02.221022+00	2026-08-28 14:14:02.221021+00	\N
7eaf1f52-8dee-4b09-8b35-690ab19ed4ff	10f488ae-e546-407e-ad82-96efb18466c6	325eb64947622c7d8c9a9cd2ea9c6d75a58f7d2404f206ebf6d9b16cc6b02f0a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 14:11:26.737702+00	2026-08-28 14:11:26.737701+00	2026-08-21 14:26:36.681881+00
e55faf82-c8b6-4627-8437-8372c49da7ad	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	2471ad160b975c72dc0700c51479b67cd5f58e15a10424db502ca27ba512c13f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:27:48.472642+00	2026-08-28 14:27:48.472641+00	\N
241ef12e-4b97-4a6b-bc35-1a29bd389749	2eeaca0b-ca2c-4c5d-8a40-7781627b2bf2	5270f4f4fbfe7e877aa77e1febf70487e892799e7b46c3f82e6d590aa766ae15	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:27:56.162122+00	2026-08-28 14:27:56.16212+00	\N
c4b4de21-4ae3-4280-9606-70ed37f95a0a	53eabe9b-cf41-4444-a608-b08e85779c01	cfe4aa7f3af2ab02903c4f0b8220b61216629cb70ce0d783e7c0c5370a25c2a2	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:28:52.583415+00	2026-08-28 14:28:52.583413+00	\N
7f53602d-a2de-4efb-b885-f4be06f5ec22	8dce0e1e-2356-4798-be5d-0c2224a69939	aaf7743d85e16a53c9f3bfe0f4964b7c226ad0faba3888bd66b1db7447cd1115	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 14:29:06.534211+00	2026-08-28 14:29:06.53421+00	\N
94c8dbca-a560-4e17-8e2b-4abf64c2cf8e	10f488ae-e546-407e-ad82-96efb18466c6	bf691ae7c9aaf3108bde192f779749319f09c8c31f1c9b3a33d208be00b8a24a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 14:26:36.68342+00	2026-08-28 14:26:36.683418+00	2026-08-21 14:43:51.061513+00
17660b2a-ef83-4ef6-a5d6-5531ff9a24e7	10f488ae-e546-407e-ad82-96efb18466c6	e6308f965ddac3f82f01797c28e9f31c396dab5dd5a34d6b48608f209c1d0bb1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-21 14:30:24.224446+00	2026-08-28 14:30:24.224445+00	2026-08-21 14:52:55.299847+00
95ef28ad-fa43-40f5-a33f-61b616097e44	10f488ae-e546-407e-ad82-96efb18466c6	6c00b288ea19b9d23278c9412b8eb5ce0107fa958bf403aac33350667468da0f	node	172.18.0.1	2026-08-21 14:58:00.864818+00	2026-08-28 14:58:00.864816+00	\N
03a6d72f-a2b6-4caf-a84e-a1e530a90fab	10f488ae-e546-407e-ad82-96efb18466c6	ed832cb24c829c9103e732535d08cc8bd63f27b625d6e39460eebce280b05c4a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 14:43:51.06612+00	2026-08-28 14:43:51.066119+00	2026-08-21 15:01:20.58008+00
feb703bf-0f2b-4cb6-89ef-a467abf601aa	10f488ae-e546-407e-ad82-96efb18466c6	968b1607070377b644b269cc845f6118e9f90f766ceb5190148cf6235d577a8c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 15:01:20.581644+00	2026-08-28 15:01:20.581643+00	2026-08-21 18:07:24.918874+00
24cb83a4-bb1d-4f31-b132-d7fcf3fbc6dc	10f488ae-e546-407e-ad82-96efb18466c6	7f455570d6e04d3d033a52b16c898fe1734f6edfd8cbe1237f6422165728c6a6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 18:07:24.921124+00	2026-08-28 18:07:24.921123+00	\N
8936f1b6-a351-4967-9038-52d986cd06ab	10f488ae-e546-407e-ad82-96efb18466c6	0563d835ad64a0a1d1586aab6a28f60e2e3bfc228ee5f29a76a18624587e66a5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-21 14:52:55.301636+00	2026-08-28 14:52:55.301635+00	2026-08-21 18:41:00.182745+00
1d05bccb-c23f-4502-80a8-910582565ca0	e4b19e15-2db5-4c16-82a8-5961cbe69a10	0f3e827d39debdee13038b5e6d1fc91415c6e76f21dd61695ac039517958d0a7	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 22:45:33.066966+00	2026-08-28 22:45:33.066964+00	\N
0f625f62-65e1-4f4e-8b5a-a5115085ec4f	10f488ae-e546-407e-ad82-96efb18466c6	272732b12a8f73238b4c1eb8eb66b89c9d97f4276379883d65a458e6eccc14ff	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-21 18:41:00.187373+00	2026-08-28 18:41:00.187372+00	2026-08-21 23:10:56.331133+00
30f4f985-23a7-4700-9f1f-c0f22510e676	278ad0a5-5139-4fd6-86b0-45014f28d6a7	3b50dc87b7c21a1af5005eed48ae105e0ec97fc08269b0d742c450cffc5cbe3b	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 22:46:40.959027+00	2026-08-28 22:46:40.959026+00	\N
e882f4fc-3afa-42da-931d-00d1db146294	88405f91-3489-4d58-b613-296bef30e2ef	95fbf3e6a35f0cb4fb3b3349fa839f8395f1024457817cecb57f926a1e267f40	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 22:47:39.354125+00	2026-08-28 22:47:39.354123+00	\N
91566e4a-3ab5-4b9f-b150-4ccccf532d5f	6912915d-4dd3-41dd-9c46-6a0efc2afa46	2f8581be57f2a98f361443bc088714d7fe72f78cb32f70a92fec2ea23edcdfa8	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 23:00:01.235652+00	2026-08-28 23:00:01.235591+00	\N
35c01768-2411-407a-8b13-2b4f8be1eea2	4afcb35b-ebb0-492c-bc26-f4961e0c43da	b2cc2d46fd741eb37153abf265b0b2f16da3f4693ae352efa1f4a162ab5efb59	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 23:02:18.276629+00	2026-08-28 23:02:18.276627+00	\N
d706971b-9af0-4c1e-a8a9-b6e9d35e933e	6b7cadef-8ebe-4d0d-b219-39e7614245ff	fc4412dde7711131d8f3a909a3649af4598fa166948c38d88fb1005fcef4997b	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 23:06:24.09769+00	2026-08-28 23:06:24.097688+00	\N
8d51a46d-76a8-4fb4-b4a5-033af896227a	3b604540-0c86-43ad-a66b-15431c4664f5	a60d176ce6563acc9bbe2ceb67aa978fe76b545e558653a6c71221126abd6b3f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-21 23:08:34.726671+00	2026-08-28 23:08:34.726669+00	\N
ad529bcf-2f5d-4472-97cf-925e4587760b	10f488ae-e546-407e-ad82-96efb18466c6	44fa626b9757fe9cca11763699eefce3177b56a610fb8e2a45d95af7179f2180	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 23:00:14.685457+00	2026-08-28 23:00:14.685456+00	2026-08-21 23:16:48.162742+00
7d864e10-ff6b-4449-b25c-4b11e12521f1	10f488ae-e546-407e-ad82-96efb18466c6	dd3874d38b0c868b5404e55ab84cb847624784772187a260160014a391ab888f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-21 23:16:48.16446+00	2026-08-28 23:16:48.164459+00	2026-08-22 00:06:52.545346+00
41306812-fc7d-4809-8e58-cafe88160121	33ee2282-5467-4c59-ac70-b4b6a020f38f	33e2d1a3f36def3c9f86b8a41537bb7573ffb3f8323c4484ace05c8b608fedf5	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 00:16:01.049448+00	2026-08-29 00:16:01.049429+00	\N
229cbd98-c5e7-4e66-8a19-b61482e20bdf	33ee2282-5467-4c59-ac70-b4b6a020f38f	f1755fd178eb6df9a53c3983b72e72ab747d1cada32251826951204bc4be5440	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 00:17:34.761661+00	2026-08-29 00:17:34.76166+00	\N
0f1991ac-bd04-4966-b56f-a84d8cb5fb52	33ee2282-5467-4c59-ac70-b4b6a020f38f	085c6a6ad2d9c04a0c5078006ecaff08d34fb1c6f3c5d67a077de7d779a4c2df	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 00:17:43.104873+00	2026-08-29 00:17:43.104871+00	\N
c706f895-a63b-4a05-95cd-86112d3ede21	33ee2282-5467-4c59-ac70-b4b6a020f38f	bf782b7930d2a350d2a721a4190d673631b30609772d3d7a0f48f41f5ae0096a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:36:42.473917+00	2026-08-29 00:36:42.473915+00	\N
1acee9ff-9476-4bd1-90b2-cbc16234ae0d	33ee2282-5467-4c59-ac70-b4b6a020f38f	bbcc6386ee8fd0cc5cb4f1456fb158951cfcb9012d1f4d45f1f05371be050291	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:38:41.140699+00	2026-08-29 00:38:41.140698+00	\N
d960fd7f-9bd8-4f0f-a2bc-2996b2a64cc6	33ee2282-5467-4c59-ac70-b4b6a020f38f	00c11ef97306ffa55111ac0c44c8f879148b19618352d20cbb3d198930a759eb	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:39:19.348991+00	2026-08-29 00:39:19.34899+00	\N
f3d598a6-7735-4b6f-98b9-bf8790df2f45	33ee2282-5467-4c59-ac70-b4b6a020f38f	f27cb0cef1893774bac7a3108f2deba2f0024beddf33b2cfe4d07a5b4681c062	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:40:24.274251+00	2026-08-29 00:40:24.27425+00	\N
1ccdf1be-bc13-44c2-823a-2662c99c3beb	33ee2282-5467-4c59-ac70-b4b6a020f38f	a78d67439b11ffe07269ed740e2fb9f96f4819295db7c87ef8b9cee095e8c2a9	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:41:57.633052+00	2026-08-29 00:41:57.633041+00	\N
f96d8c2c-9f8f-45a0-be53-bc0e01696935	33ee2282-5467-4c59-ac70-b4b6a020f38f	1da605a6ce5485a822e92b3f4937ca5eb725d01af48c34ebe15695663d406a15	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:42:55.674427+00	2026-08-29 00:42:55.674426+00	\N
292c7137-b19c-4ef5-b864-9581726f015c	33ee2282-5467-4c59-ac70-b4b6a020f38f	41c27928b8137cbc4a7ddad4122bc0801811d44f3b78a78bb6a7c48673819aee	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 00:43:29.390878+00	2026-08-29 00:43:29.390877+00	\N
11739ab3-d7b4-40ae-a977-2723a2064062	33ee2282-5467-4c59-ac70-b4b6a020f38f	1c78876dbbf0a61fdec98db53703b037993c9ee627d46135406cc20dcc9bee21	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:44:04.282699+00	2026-08-29 00:44:04.282697+00	\N
e13586f2-03fd-4976-a32e-4bd08c025725	33ee2282-5467-4c59-ac70-b4b6a020f38f	c9fae179b75bcbdef3c81f55e759f0ddd2275d6ffe20dbd73cdd1cf19999899e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:44:59.618639+00	2026-08-29 00:44:59.618628+00	\N
f8afe997-1c0f-440c-b182-1bc26ab800f3	33ee2282-5467-4c59-ac70-b4b6a020f38f	b25255a36671b567b5fb0b736dc78f77286d65ed41b4aa0613f2cfb3933221ce	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:45:14.318507+00	2026-08-29 00:45:14.318505+00	\N
ec12ff78-76b8-49bd-856b-c13fd840aaa3	10f488ae-e546-407e-ad82-96efb18466c6	8deb7a57741f5edebfbbffc4892060fe4391e9f6d851d5d0c77bb28f561a4265	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:06:52.550084+00	2026-08-29 00:06:52.550082+00	2026-08-22 00:51:12.515808+00
3203c19a-1ebe-4cd9-8cc2-deede0526108	33ee2282-5467-4c59-ac70-b4b6a020f38f	339519bf81afbbd6bfd19c1079822f71b3dfc342b55597fe7bd14b4eaa43fdb8	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:03:23.747027+00	2026-08-29 01:03:23.747025+00	\N
34cd8a2f-99ad-4ba6-b293-f06575b806eb	33ee2282-5467-4c59-ac70-b4b6a020f38f	2e63401cc258f5f3698e8be5e544caf09af49359fdae51d86765077dc8df0208	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:03:41.515668+00	2026-08-29 01:03:41.515667+00	\N
560c2488-74ec-436b-93e5-dc7e63376316	33ee2282-5467-4c59-ac70-b4b6a020f38f	bfcf63c58d382c81264fe6d21a869f740fa359d411a61c1fe1317589abf92591	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:04:43.392924+00	2026-08-29 01:04:43.392922+00	\N
95fd02e8-7855-46e2-9eb1-1528e49a361f	33ee2282-5467-4c59-ac70-b4b6a020f38f	dcda28ed9a830110b77ca5179a3829143dfd8de73fa65095e45c0c7a254532da	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:05:49.671352+00	2026-08-29 01:05:49.671351+00	\N
0fe4470d-85ec-4bdf-b10e-c94e3f4d7a2f	10f488ae-e546-407e-ad82-96efb18466c6	5f5ee10b528f97bbfea300b4bc514f77d31b74e7eb4dc6ec6e503a49c20046b8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 00:51:12.519354+00	2026-08-29 00:51:12.519353+00	2026-08-22 01:07:05.264819+00
d728643d-237f-435d-83b5-8de5c9f5e1b4	10f488ae-e546-407e-ad82-96efb18466c6	8e006d34a6b2a3cae9c88e86196cd3faf6101f99a5ebfd66e7974aebcef83df4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-21 23:10:56.332256+00	2026-08-28 23:10:56.332255+00	2026-08-23 03:46:27.533512+00
2392355c-44b7-413d-b3e4-1eeed1beb647	ba65bf54-08eb-4e24-92b3-2e15df894059	dd7f0e0317b8e95322f3d1ac519d772d37cdc2b62be6a7d5f978c52d95228f59	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:06:35.692785+00	2026-08-29 01:06:35.692784+00	\N
e06ba835-5cfb-4b5d-affd-1a459992f0cb	33ee2282-5467-4c59-ac70-b4b6a020f38f	557195b76bca396bf185f9793301db3d1a485cb2b53af34c6d4cf4a3172725ae	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:06:36.621353+00	2026-08-29 01:06:36.621352+00	\N
850f761e-4de0-496b-bb31-9ec7fd763b2b	917cf438-53bd-4522-965d-71a60c34b814	0b54c89572a38441beedacb7d512450268f1c4ab294ef35ba035599334b2bd2f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:07:15.819027+00	2026-08-29 01:07:15.819026+00	\N
596576c6-8409-45fb-82a5-9a95cdae5432	33ee2282-5467-4c59-ac70-b4b6a020f38f	ca846bd862759bf3ed38a534e13a5ab712964ed96496017092f7fcbb4da3b06c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:11:12.285661+00	2026-08-29 01:11:12.285659+00	\N
83d96995-ba6a-4bcb-ada2-31d6221ce844	33ee2282-5467-4c59-ac70-b4b6a020f38f	df8f2642c5a4278dd3dfebacd870e4d6af7f1b3399e8bde018a75db275828faa	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:14:14.052361+00	2026-08-29 01:14:14.052358+00	\N
c6d464d6-9a18-460d-b1f6-cbe6d954d92f	33ee2282-5467-4c59-ac70-b4b6a020f38f	f0af50302568bbf9356164bced9447a925ff07f287df33a95c3b35f73629deb6	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:19:19.859346+00	2026-08-29 01:19:19.859344+00	\N
623aed50-e85e-4b8e-b15f-26268caa66cf	33ee2282-5467-4c59-ac70-b4b6a020f38f	2a44f132e8fc9a4a2d9f77adeb5b2b0656dda328ca49850745cb5d0a0ebe32c4	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:19:58.050669+00	2026-08-29 01:19:58.050667+00	\N
21dd259a-853b-4f8b-a2d7-85926c2c2571	33ee2282-5467-4c59-ac70-b4b6a020f38f	9d4fd15ed569d54af163080e9479b687b9b4ecc60b04d96868aba2e4a1b1cfd2	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-22 01:22:19.512527+00	2026-08-29 01:22:19.51252+00	\N
5adb146b-af26-47a5-be18-a0e24017b712	33ee2282-5467-4c59-ac70-b4b6a020f38f	8967103ba897f94547059215fb61d27ae84de7b4791f312c174496b3c57f0703	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:23:11.173324+00	2026-08-29 01:23:11.173321+00	\N
62b59015-2d2d-413a-a399-9ed48b7751fd	33ee2282-5467-4c59-ac70-b4b6a020f38f	47b36c6d9649af0b5c462f5ac998cfa95a16e3a059980dfd54d28c68d00ca828	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:23:35.523113+00	2026-08-29 01:23:35.52311+00	\N
64b8b16a-ebc0-40ab-9eed-f029abd3e089	10f488ae-e546-407e-ad82-96efb18466c6	85aac1254a8e92b14aa325bbd76791255935eb730af5cbeb401805d199f25bcd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:07:05.26681+00	2026-08-29 01:07:05.266808+00	2026-08-22 01:26:37.160841+00
97f5f732-cf85-4e23-b522-95525077d4c4	33ee2282-5467-4c59-ac70-b4b6a020f38f	492a38fa19e71c94479cd2c43fc2bc86e6e3e3aeeaa730694b4eb1f959b40a31	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:30:28.432984+00	2026-08-29 01:30:28.432982+00	\N
4a70de7e-7d57-4361-b56c-987c11f9c047	33ee2282-5467-4c59-ac70-b4b6a020f38f	672d74da5495591f98d268254c9bab93461d0b89136d61e29f682564be0df0df	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:30:45.279428+00	2026-08-29 01:30:45.279426+00	\N
008157a6-1035-4a18-b9f6-f8ae89a5f81b	10f488ae-e546-407e-ad82-96efb18466c6	75011a67919f7043a14ce2996dd9ac789c71b4bf61b6b2f2079bdd53ec4126e0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:26:37.164796+00	2026-08-29 01:26:37.164795+00	2026-08-22 01:55:42.998304+00
62e72433-a46d-40ac-9a30-4ed0b63d6e32	10f488ae-e546-407e-ad82-96efb18466c6	2743a248bdd554b4986b9792c0421cf6c43c68460d19eaabefad29182c6a2f3d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 01:55:43.001677+00	2026-08-29 01:55:43.001676+00	2026-08-22 09:35:56.083522+00
a698ac84-ed74-4a64-8d84-4d8768404a42	10f488ae-e546-407e-ad82-96efb18466c6	784bd9deabf0494cf7ad50b9b56b60678cdc178baa0f10432fbcc01ab8742e95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	172.18.0.1	2026-08-23 03:46:27.543923+00	2026-08-30 03:46:27.543922+00	\N
8068c4fe-f1ae-4053-bec5-81d480d97fc5	10f488ae-e546-407e-ad82-96efb18466c6	fa5b2e2fce561402db7fe8205e00715c010aa463c77312fea724bdf8a1c463fb	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-22 09:35:56.08578+00	2026-08-29 09:35:56.085778+00	2026-08-24 11:47:36.95744+00
0c303141-59bc-46b2-adb2-1cfa66e1b053	10f488ae-e546-407e-ad82-96efb18466c6	3a416a364958517d20b558fcf73adca371411faeaa39ce0d8fedef7e667017bc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 11:47:36.987848+00	2026-08-31 11:47:36.987848+00	2026-08-24 12:39:47.940964+00
191d3edd-de3a-4563-8fed-7c382607d10d	10f488ae-e546-407e-ad82-96efb18466c6	28b5d99649b4602736960ddea9b9603c34636bd5f716fbce528d293544454e9a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 12:39:47.944606+00	2026-08-31 12:39:47.94456+00	2026-08-24 13:04:22.819877+00
1ed32908-61c5-4dca-982a-6af6645c5e5c	10f488ae-e546-407e-ad82-96efb18466c6	acf8d317431d48cfa38c9eab979b27a15872193182d150e31041ff15dd25fd44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 13:04:22.823418+00	2026-08-31 13:04:22.823417+00	2026-08-24 13:23:57.719509+00
767e48ef-d17f-490d-9fb8-1bf5cc640f4a	10f488ae-e546-407e-ad82-96efb18466c6	c90aa0bf1f8d987b520a018bc30c1cd49f664519a64ee64de98eaeaf18d7fd84	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 13:23:57.721283+00	2026-08-31 13:23:57.721282+00	2026-08-24 14:10:53.627167+00
752ce9f8-c7ba-421b-9274-90919751dbe6	10f488ae-e546-407e-ad82-96efb18466c6	9f26a52be99d01cce764d3a3b662c011283bb92b0e696cf21e2a4553aba38123	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 13:23:13.591086+00	2026-08-31 13:23:13.591084+00	2026-08-24 14:16:15.339932+00
60104829-702f-42e9-83b3-dd0f80c295c7	10f488ae-e546-407e-ad82-96efb18466c6	5688cf3cdf5f1d7ee064c8f83359b035625067a4abdfe13f80d4b8f006c8702c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 14:10:53.628688+00	2026-08-31 14:10:53.628657+00	2026-08-24 14:33:55.966676+00
62c7d17c-191f-4ffc-8c17-09f26cf6423f	ae2e7050-4bc6-407b-b670-98d82a215b9b	ca09c9d7dbc749a158f88fbc66e4118bfa2b07da94a9161081801db45c098088	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 14:59:29.895111+00	2026-08-31 14:59:29.895097+00	\N
e92989aa-c972-4d4e-9830-311900a304d4	10f488ae-e546-407e-ad82-96efb18466c6	641af45d40cd89e681f6b9257799e46f4f99deb2105d334dabfb8affd30a2c99	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 14:16:15.342799+00	2026-08-31 14:16:15.342798+00	2026-08-24 15:03:16.65259+00
c3556e28-9c0b-4341-bd70-a717a4f1d2db	10f488ae-e546-407e-ad82-96efb18466c6	c0217df2a9697ee92ee6d83437d6afe2f189ed7ee259dd0bf12b09c4733f8213	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 14:33:55.969248+00	2026-08-31 14:33:55.969247+00	2026-08-24 15:06:40.731266+00
39b86ecb-6db4-44a8-8c73-b86594fcc783	10f488ae-e546-407e-ad82-96efb18466c6	c267d577e498b9ac25e93141ba77d5f6dd3e70486672af552824e5e82e81422d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 15:03:16.656741+00	2026-08-31 15:03:16.656741+00	2026-08-24 15:27:56.959293+00
a81e2282-7c8e-4266-9344-d02c6841e47a	ae2e7050-4bc6-407b-b670-98d82a215b9b	89931c2af3da9a71450899ebe8b78fb1b5795afc3675c1b5ca1eed7efa8193f6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 14:59:37.21404+00	2026-08-31 14:59:37.214039+00	2026-08-24 15:29:48.907646+00
e98d53f1-e302-42c5-a8c6-f8d745a2e4e6	10f488ae-e546-407e-ad82-96efb18466c6	1c9188ba9854bbd0198c0c7a13f2c6b1893d22d7e957cfe7ba80f33fcf7976c4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 15:06:40.734913+00	2026-08-31 15:06:40.734912+00	2026-08-24 20:27:10.752605+00
fb2543a1-09f9-4c3f-9aa2-2d96bc743e14	10f488ae-e546-407e-ad82-96efb18466c6	81ced7cc573ca7a05ea84d0c1097d962e12095f8efc8bd242f0fd98db8a4bdfa	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 15:27:56.961429+00	2026-08-31 15:27:56.961428+00	2026-08-24 15:43:21.092542+00
be3f9d07-40b6-4102-9a7b-b8032cf2f84c	10f488ae-e546-407e-ad82-96efb18466c6	46dc8ae3305da8f4a9827aa5e7e97e60017e4a61f3d81dd857f13e677a5c5313	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 15:43:21.095174+00	2026-08-31 15:43:21.095173+00	2026-08-24 20:44:17.351186+00
7d5625bc-7b30-4709-9552-8c78a9df0aa6	ae2e7050-4bc6-407b-b670-98d82a215b9b	271a7d8c1d90423f57dfbc26b6092ad2f01199090ebfca34a3b8913da0ad8187	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 15:29:48.909806+00	2026-08-31 15:29:48.909806+00	2026-08-24 20:46:34.373636+00
74d277f2-1049-49e7-960b-248ed121775b	ae2e7050-4bc6-407b-b670-98d82a215b9b	688f1cfe30926d7410d7226578f8f27377c84bf1154a5e0b27c1c900bd3755a7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 20:46:34.376017+00	2026-08-31 20:46:34.376016+00	\N
0ddfec56-2994-4443-a9cf-db5e8dcfbce8	10f488ae-e546-407e-ad82-96efb18466c6	5511ea695db10e946b6cdf39d08b3210a8b54e2c3f8c37f6d7fda3fe173ab356	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 20:44:17.354937+00	2026-08-31 20:44:17.354936+00	2026-08-25 07:12:50.988133+00
2737f56c-e916-4e41-94bb-ea5897efc7af	10f488ae-e546-407e-ad82-96efb18466c6	dbf091ae3ac72b52ffe8af98d53410b74f58559ad7e22228aa83b1f14f21d884	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-24 20:27:10.756781+00	2026-08-31 20:27:10.756779+00	2026-08-25 07:16:05.262404+00
add156b3-fb16-456b-93f1-bceb06de803f	ae2e7050-4bc6-407b-b670-98d82a215b9b	da3023b84b14d8c2f59a98d3fc2fb561ab7f3b117f4f6a368c237b648e09d8bd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:12:39.383287+00	2026-09-01 07:12:39.383255+00	2026-08-25 07:32:44.509299+00
ac11c665-9b5d-4101-bb6c-9a220dbe67d5	10f488ae-e546-407e-ad82-96efb18466c6	de478bd9aaa16eb6938995e5b2e518dc2887636ecd844e86052dc9d6a7698aa5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:12:50.991581+00	2026-09-01 07:12:50.99158+00	2026-08-25 07:32:45.982793+00
434861b4-0cd1-451e-a29b-3ef28cd56402	10f488ae-e546-407e-ad82-96efb18466c6	ada4b3498b69f44058eff292c2501a5948cb41710b2f7283a4d9c5c0f38c57fd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:32:45.985536+00	2026-09-01 07:32:45.985534+00	2026-08-25 07:50:48.328437+00
ed5f866e-9183-4c45-bdbc-0eba25220791	10f488ae-e546-407e-ad82-96efb18466c6	94c7c7d915d1d19f4ad30f9e160375fa347612b07ac4449e9bf2c8a767547efd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:50:48.332407+00	2026-09-01 07:50:48.332407+00	\N
ea5f6c12-ff75-4fe6-8c88-2b143c587c94	10f488ae-e546-407e-ad82-96efb18466c6	64a36917d7e4283f00667183145970ac1b8fc52a06fa5aee982b4569baf5d74f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:16:05.264608+00	2026-09-01 07:16:05.264607+00	2026-08-25 07:51:47.234033+00
2ae79d64-d2a4-4d47-b1b7-b79e40455a37	00c2d92b-4a5a-4000-b15b-a888d217f4c9	7657529b081ec52dcf88086e3656a8e756ddfdf95c707b8490cb41893b3f5fc8	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:01:24.147796+00	2026-09-01 08:01:24.147795+00	\N
f9a7e433-23b6-4fcd-933a-e87319a14f55	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	8e92d09d8a6650608345f985c614630a8088a83cfa0d0a9ea28c577c6df82042	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:01:24.276159+00	2026-09-01 08:01:24.276158+00	\N
b4f36f9f-bb4d-4c69-bec6-18f244a7b0ce	4ad3d1d8-8224-48e3-a15f-efd114544a97	10c1c992eaa92a02c2359d59c65ddb905b99b3cc76d05bf55a24d917976bde8f	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:01:24.359968+00	2026-09-01 08:01:24.359966+00	\N
84747874-69c3-4011-b9e6-62fd84515371	00c2d92b-4a5a-4000-b15b-a888d217f4c9	b60214d812163000c753acac90aea2a40ec057c93ee0f2f77da6aed6a3891b79	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:01:46.719093+00	2026-09-01 08:01:46.719092+00	\N
b4b7541e-2489-4310-997f-7dd94856dff3	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	0832b6d4c6d9d1189883c717c3c4ce4b01f7e61f2e3bab09182e116dc45ab0d3	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:01:46.827848+00	2026-09-01 08:01:46.827847+00	\N
85a921ea-93a6-44b9-8034-3f43d0160e37	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	ad83461cf8121d2785f65a755e1bd732e30d0f3759e4b0d357e6bca8b2c23571	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:02:14.266791+00	2026-09-01 08:02:14.26679+00	\N
b2226dc4-5ba8-4631-8bfa-979357ee3c55	10f488ae-e546-407e-ad82-96efb18466c6	e90c57eaacbbfa6b78f4daea1888378bd04e5099c4859e17a963464078249694	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:51:47.235556+00	2026-09-01 07:51:47.235555+00	2026-08-25 08:09:05.038109+00
f4c14cfe-fa5c-4990-b434-b15a034979d6	ae2e7050-4bc6-407b-b670-98d82a215b9b	cb7d3f4265f170f8f6724ec8f59d1f9c54ba086e85bf67eb8715ae465003ec48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 07:32:44.514616+00	2026-09-01 07:32:44.514614+00	2026-08-25 08:10:32.337943+00
8f05490d-e5fd-4c59-9427-bce59751bd5b	00c2d92b-4a5a-4000-b15b-a888d217f4c9	832b964ad335f5d179bc095df71c8b868dab353541935b2e07478b7601c0f0d8	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:13:06.118124+00	2026-09-01 08:13:06.118122+00	\N
e22b6b9d-184f-4da4-a575-3fb3b5269f52	00c2d92b-4a5a-4000-b15b-a888d217f4c9	e14a68b6aab6b592937273ee0b8a9ed53293131f61bfa356252ab95e348104e8	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:13:14.342217+00	2026-09-01 08:13:14.342215+00	\N
b0f9109b-3600-4f30-b501-8ef589009118	00c2d92b-4a5a-4000-b15b-a888d217f4c9	f31de007c9f022cf80d0e02f474371915b9d4ebc94fe05b68311939692aecaeb	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:14:30.974535+00	2026-09-01 08:14:30.974533+00	\N
f2d6a211-b314-4348-bd1d-ae9ecbfc0da4	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	4dc5257caf92f500f6764272f31e2e2341fc538611bd58fafe732be9024ea233	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:14:31.067761+00	2026-09-01 08:14:31.06776+00	\N
606c2133-ad06-44d2-a1fc-ac1c4eab1711	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	e9c89fd79e3c58fb2b93e3b2e362e4eb2dcf5a65afc9f72dc3160588e9eb5a14	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:15:29.00572+00	2026-09-01 08:15:29.005719+00	\N
350931b2-da63-4e8a-ad89-e7447648f7c7	10f488ae-e546-407e-ad82-96efb18466c6	b306e06652ae870f3b891cfdf6431a4c0c6c1c5c339d616f323796382bf9804e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:09:05.040382+00	2026-09-01 08:09:05.040381+00	2026-08-25 08:24:11.721115+00
2adfb4df-bc28-4a4d-9664-673968c4a54f	10f488ae-e546-407e-ad82-96efb18466c6	8ebc6a0ed0b37fa796f0ea4644da7d8dffe69d046047eb341d170b4407f1d390	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:24:11.725455+00	2026-09-01 08:24:11.725454+00	\N
55a484fb-f69f-4ad3-91cf-9ea26a864da4	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	d69ea31f5bc6f1ca01e81cff281a9c40d3e07f4fa9f86ed8f1dafc4d94da58dd	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 08:24:38.612681+00	2026-09-01 08:24:38.61268+00	\N
7d5f9629-54a2-47ce-8d64-260adce99efe	00c2d92b-4a5a-4000-b15b-a888d217f4c9	4575736c9ca8a34f5761c0c39326eab6b48632a9b1bcee512f883252577df482	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:02:31.829629+00	2026-09-01 08:02:31.829626+00	2026-08-25 08:25:14.669306+00
5101e22c-9181-4412-825f-e8a07d011551	00c2d92b-4a5a-4000-b15b-a888d217f4c9	8c3b6a889cdd63056e96899223470bbb57d7f6f93ecd8affd1873355cc507fa5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:25:14.671082+00	2026-09-01 08:25:14.671081+00	\N
7f95f8cb-b205-4c7e-beeb-b608e182e883	ae2e7050-4bc6-407b-b670-98d82a215b9b	83b2407c6951f0b2f020eade0150d9d1bef85ddb9965a7cdae75aa402b93d063	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:10:32.346006+00	2026-09-01 08:10:32.346005+00	2026-08-25 08:38:21.617803+00
5d72273e-fe0a-4722-897d-b13f30af6bf3	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	1841f62ff0880ca8fc1460ff9c95ede437ef37f75ed377486d307cd04f8d78be	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:25:44.240856+00	2026-09-01 08:25:44.240854+00	2026-08-25 09:02:33.622712+00
114475fc-a4e0-483a-999e-9f3590331ac4	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	ef2437ab54a4eb4a2546b8ceec528a916dbac47e87807ebff45c5be707ae5cb3	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 09:49:11.617616+00	2026-09-01 09:49:11.617578+00	\N
bc0808ae-4f8f-4ca8-a3c4-07063c15857a	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	85a148391ba03b7fef0270e0c4943586b4f0c7108183f8fb5aaf3284580cc11c	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; fr-CD) PowerShell/7.6.4	172.18.0.1	2026-08-25 09:49:27.863386+00	2026-09-01 09:49:27.863385+00	\N
38d956b2-735e-4c1f-8d2c-ee23f6b498c1	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	3edb18867bd3f8cd5252b05f053a6f4b8e71e08df0ce4404e3396777ee2d4de8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 09:02:33.633178+00	2026-09-01 09:02:33.633177+00	2026-08-25 12:11:24.951722+00
543d4cc7-1744-46a9-a314-d98780c2e3e4	10f488ae-e546-407e-ad82-96efb18466c6	a8b12d8a69e8c83b8198f5c6df6309187d9444b9f82d04cb1574a6722727b25c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 11:48:50.011737+00	2026-09-01 11:48:50.011735+00	2026-08-25 12:11:52.257473+00
7f5940e1-cd9c-4e78-be8c-7ee241f43769	10f488ae-e546-407e-ad82-96efb18466c6	d680d0054b2a92559003c36aa41dff678c36feb29b5b5470f8e205bfa089be0c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 12:11:52.259576+00	2026-09-01 12:11:52.259575+00	2026-08-25 12:30:03.727151+00
b275d2a0-f507-4f26-9451-1aeb60d26a04	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	7de7a4859a25e08adfc659263496ba5ab6d0b99b85aaa371dc53e88f306f2074	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 12:11:24.956468+00	2026-09-01 12:11:24.956466+00	2026-08-25 12:40:20.63559+00
993ce956-f569-4133-96a2-3df5d92555a8	10f488ae-e546-407e-ad82-96efb18466c6	d316ae5ea65ec668fde4477b1453e956234c19451ff1f60f03b8f0ef569b28cd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 12:30:03.734688+00	2026-09-01 12:30:03.734687+00	2026-08-25 12:45:27.849679+00
834d1a41-2cc9-4f26-86e2-8e8288a7863f	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	8a8273a46f6053a7fc0e738daa673f9bdea9a120427b12655c21d484cb4a7e74	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 12:40:20.637708+00	2026-09-01 12:40:20.637707+00	2026-08-25 13:09:56.172573+00
8be531ac-12b4-4636-91d4-eb63730edec4	10f488ae-e546-407e-ad82-96efb18466c6	2313b652cc949b254149e1581c6931c80acb240d988184139ebb4e0c20f9333a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 12:45:27.851383+00	2026-09-01 12:45:27.851383+00	2026-08-25 20:46:29.199068+00
e6aef669-907a-499f-848a-0421bed52548	10f488ae-e546-407e-ad82-96efb18466c6	dab282fe4c3089794c19a585b23033e01f1c6ac8aad12cfbd2c6f853c362a714	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 20:46:29.212897+00	2026-09-01 20:46:29.212896+00	2026-08-26 09:13:17.670941+00
b424f5b5-df61-44cc-a5df-c0eefc48502e	10f488ae-e546-407e-ad82-96efb18466c6	d5ebfd01bc23791d7fd2149c5584d027b977290d4a9dea84b619149cba4e2276	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 09:13:17.673624+00	2026-09-02 09:13:17.673623+00	\N
dd3ab35d-7f76-47fc-bfaa-5fd0378d8aa2	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	3422ec8221bf843506bc2405f64d7d44d1d500261dcbbf3f136d2564deaca860	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 13:09:56.174357+00	2026-09-01 13:09:56.174355+00	2026-08-26 09:40:07.103884+00
056822af-5201-4181-b3ab-8c3d0be3d2d2	0569f950-4bfd-4f1d-9354-2ad7672e6dc3	29b894c162ecd7b429bc41f65dddf1f5e231bf63b01cf17b04f44c628ef40cd3	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 09:40:07.108613+00	2026-09-02 09:40:07.108612+00	\N
8d5e5029-5c9f-49df-a5fe-b71f1f102dfe	10f488ae-e546-407e-ad82-96efb18466c6	1629169936685f505ba6e6aac33772821cf0b4a8fad44b98b04eca13ec52fabc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 20:51:15.070274+00	2026-09-01 20:51:15.070273+00	2026-08-26 10:27:34.202445+00
73af10f6-f25d-4613-b324-69c36a3f8069	2b453813-5644-4fde-b134-d2bc067987a9	714d05613c8a9b912f64e7156775452d38951a97102693b2a32eac93bc99da3f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 10:33:53.348552+00	2026-09-02 10:33:53.348535+00	\N
6dec93ed-f216-41f0-8b89-b2ebc174822f	ae2e7050-4bc6-407b-b670-98d82a215b9b	2a997d5147914b5053ba8223f3bf33fe3fec24ff98f0cad16d996baa014bb9de	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-25 08:38:21.627308+00	2026-09-01 08:38:21.627306+00	2026-08-26 10:41:08.509882+00
6339135b-761e-4f59-8bea-33c01ec51076	10f488ae-e546-407e-ad82-96efb18466c6	cbf5634eec778ce31bc4ca950e5ea3e45d82580ea2bf2f1da494830d8140575a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 10:27:34.210326+00	2026-09-02 10:27:34.210324+00	2026-08-26 10:43:14.161173+00
38d58404-4ae8-422d-811c-9952cec25531	10f488ae-e546-407e-ad82-96efb18466c6	73d755b934322e0afaf300062ce223b47b057d74b1b71951e3be00cc1fd7888e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 10:43:14.164289+00	2026-09-02 10:43:14.164288+00	2026-08-26 11:06:08.054282+00
0bf5ab5a-a2c4-474e-92c1-a89665c810f4	ae2e7050-4bc6-407b-b670-98d82a215b9b	4931d8badbf064ad263336da372153fa8eb5800b4a166c7ebe179baaf4c56d04	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 10:41:08.511823+00	2026-09-02 10:41:08.511822+00	2026-08-26 11:06:16.843363+00
8aafd08b-65b4-4b93-8146-f7b1ea43b42c	10f488ae-e546-407e-ad82-96efb18466c6	04d89c174f0eed3b3f07ecd1cd57f8e110ec7526cd7455d104535b16ceebbb9a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 11:06:08.056471+00	2026-09-02 11:06:08.05647+00	2026-08-26 11:21:13.748134+00
51229d61-3d55-49e0-93bf-8fd4ea121f91	10f488ae-e546-407e-ad82-96efb18466c6	3ff152ea7f973ee0e0206f84b1e7173a06abcb2bfb0a1cd10ef5d09990faa935	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 11:21:13.754358+00	2026-09-02 11:21:13.754356+00	2026-08-26 11:39:06.400821+00
7c06737c-4ce6-4187-a1ca-3c78965c01a6	ae2e7050-4bc6-407b-b670-98d82a215b9b	d3ed3d536a4eb515a2a3f59de26f87f92400cc69407c78a53f666992df0a6b4e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 11:06:16.8451+00	2026-09-02 11:06:16.845099+00	2026-08-26 12:10:04.89212+00
48000dff-5eba-45af-89e6-0016d9b6bc74	ae2e7050-4bc6-407b-b670-98d82a215b9b	e0c792ed8dd6278d1d53a66f4568c5d8eb4be87337fdb7ea2108e2d49c0886a7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 12:10:04.966553+00	2026-09-02 12:10:04.966519+00	2026-08-26 12:29:23.873695+00
3f15e8e5-7496-4d26-8645-0b5d93da4db9	10f488ae-e546-407e-ad82-96efb18466c6	b1cf47cb266261360ea138e4a1f0816b94e87c2a86111e0fdb3f2977ea70b667	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 11:39:06.403681+00	2026-09-02 11:39:06.40368+00	2026-08-26 12:41:16.596801+00
e924b789-035e-44ee-bd89-787c2446a193	ae2e7050-4bc6-407b-b670-98d82a215b9b	738a8fe2dd97c8b3569ff00b50b779cb7033311b8a41e80a422a5a580c141a16	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 12:29:23.875352+00	2026-09-02 12:29:23.875351+00	2026-08-26 12:59:47.250178+00
1a2db4d2-baec-4c13-969c-50d12ad9c6b7	07f2e0b3-6709-4cf0-afcc-6b24db94ce93	e54defdfcc54d2c4915e941f09cfcb811699e2c1f7e678aa6af1cfa30ee31159	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:17:24.93544+00	2026-09-02 13:17:24.935439+00	\N
9caecc5b-6580-43a6-a0ca-eca5d7946ea7	10f488ae-e546-407e-ad82-96efb18466c6	5b3b010007e0e58dabb2918c47bb364ae380cf83edfe93aafcbb7d1e134ccd9d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 12:41:16.721855+00	2026-09-02 12:41:16.721852+00	2026-08-26 14:13:46.568657+00
7fcc0b40-9baa-46b7-bd3a-f1984cf9346a	54998434-5ff1-413a-91fd-c928cfbae493	1cb420ae8a1ea07ff07c6e89cd58cbfb5818ba68c0bdd5786808a183e22f51e3	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:17:30.131644+00	2026-09-02 13:17:30.131642+00	\N
aa3e0cf6-871a-47b6-b42e-19bb0e4ae0f8	2f4bb545-2f88-4326-a274-e12b0815656e	55226ae9fa50d9b1bf478ad7bd093bbbdbe6cffefc38504b790f7c5cf8149b7e	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:19:02.202079+00	2026-09-02 13:19:02.202077+00	\N
ebd6baa8-9379-49c7-93bc-6259eeefad02	d440befb-c451-4c38-95f1-ba5c057ca0d9	7b9d862bf9dfd1fc27f29c1886a0b60797c89fce2ef926d0052da397ee142ffa	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:19:07.126641+00	2026-09-02 13:19:07.12664+00	\N
f5147dfd-cb1f-4cf9-ad50-0193e96a9e20	d440befb-c451-4c38-95f1-ba5c057ca0d9	355b03674e55609f7c1680f0cbf0cdac237dcb8e2e61d64f00cb79de8fb7eb0d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:20:40.379181+00	2026-09-02 13:20:40.37918+00	\N
3eedfd46-19b2-4459-a37b-aaf680da37c2	d440befb-c451-4c38-95f1-ba5c057ca0d9	27a1d133428d2520c03126cd6a928555fd64ea529cbf35f5e9470441b2fb763b	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:23:53.459427+00	2026-09-02 13:23:53.459426+00	\N
9f4f22e9-8f53-40ec-acd5-088d01b7552f	d440befb-c451-4c38-95f1-ba5c057ca0d9	0f82be5c680934ecab6c1ccb792c7f01f2dc87e5bfc445e891526131947d066d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:24:12.462265+00	2026-09-02 13:24:12.462264+00	\N
9c581abc-d15a-49b8-bf4d-0256e36ee531	80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	3bbd7ba35454deec50b76f562820c94967ed1fdaf9eac62bd44c0bc76e78e83f	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:26:35.70452+00	2026-09-02 13:26:35.704519+00	\N
d12706de-072c-4122-a2da-99f2828b56e7	5593d59e-3cc5-4da3-955d-80f2cbbca1fd	d5630fa7509e5cbd019519f064af57f8872f6868f9f888ed586346023a684d74	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:26:41.008142+00	2026-09-02 13:26:41.008141+00	\N
91652c3c-ccbf-4e4f-92ca-8e0e564e1620	df9edc86-2eac-40d6-a0b4-625385b387bc	8b96fdf87985b03fe105beb2d4ad45fce21362c3a1ba90d96ba14bb3a47789d7	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:28:08.032691+00	2026-09-02 13:28:08.032689+00	\N
5209d12e-640d-4915-9806-315d9247b0d4	5384da9a-5b5b-4df0-9063-7cbb8cd163ff	99b738bb6638a27a2eff01a9a5e6a2280fa63fc9338ce61be2bf714063244f27	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 13:28:13.464726+00	2026-09-02 13:28:13.464725+00	\N
b05dc84b-27b1-41b0-afbf-e205426e8870	ae2e7050-4bc6-407b-b670-98d82a215b9b	186de67d9447d49f11b69e42aecc9f2c935f8e61dda25d5278c9d7684665e304	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 12:59:47.25283+00	2026-09-02 12:59:47.252829+00	2026-08-26 14:11:12.83233+00
9cc865aa-971c-4521-ab8f-0119a8e30a24	f87c1ce5-6819-4d12-a0a9-85055d806ae5	1525735b3b66a26ac495168974d258b3e11066a785e08492309818037d0177f7	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 15:20:09.214515+00	2026-09-02 15:20:09.214495+00	\N
780751a6-65be-4ab5-a0fa-f4961dc7aabd	f56c4268-e4d2-4382-8e8a-8ba603e663f7	00f247b13816b345225214d2b75201305e8af5df1c0f63fee2657ca91e68f394	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168	172.18.0.1	2026-08-26 15:21:26.105997+00	2026-09-02 15:21:26.105996+00	\N
b9c03bbc-4d25-46ff-b141-3a721a1c36cb	8700aec8-b351-4e33-845e-8254918e00ad	ab5c4b0b11671fd8ebf674c14d7b0fb7bbf127493d306b646cf384fe9d7d4eb9	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 15:54:13.599064+00	2026-09-02 15:54:13.599032+00	\N
1fc006ed-63b2-40e5-8e87-2e1b41a29adb	10f488ae-e546-407e-ad82-96efb18466c6	305e71c83abfcba1dd439dc6dd29283e7c0e8a7f1b4a8ac26e17856043eab78d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 14:13:46.570289+00	2026-09-02 14:13:46.570288+00	2026-08-26 16:10:11.206587+00
2cf96eb4-86b0-4a05-a381-1e5c5554557b	ae2e7050-4bc6-407b-b670-98d82a215b9b	f5eb0f094daa3981959f8ccf9cd8528ab8c8c33536839cd07e1e8e9f8546155e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 14:11:12.840601+00	2026-09-02 14:11:12.840599+00	2026-08-26 16:21:50.044409+00
4289737f-f651-40db-b029-d54c5b18be45	8700aec8-b351-4e33-845e-8254918e00ad	8085466f0e0781934bdabc52cda8c2b458aa3caa587e90501cbbfc7162360f4b	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 16:21:43.44522+00	2026-09-02 16:21:43.445196+00	2026-08-26 16:39:55.425964+00
7f7253c2-9dbe-42d2-a113-25ec3badf7b3	10f488ae-e546-407e-ad82-96efb18466c6	9832218f22cbb5f1823304cffbce79b2b3b27516742777ed0bcb3c10d4151752	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 16:10:11.218293+00	2026-09-02 16:10:11.218293+00	2026-08-26 16:42:43.932007+00
b6e1de11-16ae-4c05-8298-d5b0128a502b	8700aec8-b351-4e33-845e-8254918e00ad	0f583aa29ccf8f6898eff8455fb26bb4a8ffef3e5a6d8135c807303e4c976d19	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 16:39:55.430245+00	2026-09-02 16:39:55.430244+00	2026-08-26 17:03:33.608944+00
da55c1f6-d9dc-4852-b59d-c698eea8500e	10f488ae-e546-407e-ad82-96efb18466c6	2fb6195f36368f8dbbf4dedf147faee67ecd4444520584ade9c345d5157d8f91	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 16:42:43.933905+00	2026-09-02 16:42:43.933904+00	2026-08-26 17:05:26.200722+00
28ff7a27-1049-46a7-ac38-a0b0a32fdd3e	8700aec8-b351-4e33-845e-8254918e00ad	288ab8d5fea7055b86795ab3159f52d100d1d15c2c4aebc3f3a2a9e1a7a097bf	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 17:03:33.614015+00	2026-09-02 17:03:33.614014+00	2026-08-26 17:58:51.91039+00
238dc178-c18a-4855-bc6c-0c6de2da3545	ae2e7050-4bc6-407b-b670-98d82a215b9b	0ad5cea282bf2509346e92cc7070613a2c1e170e403abcd173ff0d37f15c6ebf	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 16:21:50.046101+00	2026-09-02 16:21:50.0461+00	2026-08-26 18:02:54.846425+00
936145b8-b075-4fda-825f-ec7f4a3eee3e	10f488ae-e546-407e-ad82-96efb18466c6	fc91fdae06cc3d174aed48cfb721c1a2f57877a028601457366ae18c4e752664	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 17:05:26.203904+00	2026-09-02 17:05:26.203903+00	2026-08-26 18:09:01.745347+00
b0898de2-ff67-4607-9bb1-bc5bb6209971	1bb14759-9967-4d6c-8a65-91e91731f726	333b607fe508f9d21118469c5a3e951922a6c5b20d5041f991cbbffed2d48e4e	curl/8.21.0	172.18.0.1	2026-08-26 18:33:25.376218+00	2026-09-02 18:33:25.376179+00	\N
e2f49766-2b30-4ac8-aea5-53f624453537	8700aec8-b351-4e33-845e-8254918e00ad	2aab4bca176fc3be0e1286af55dd0cdf65dedb7a4238bb82fc081b22a24ae0bf	curl/8.21.0	172.18.0.1	2026-08-26 18:35:09.850832+00	2026-09-02 18:35:09.85083+00	\N
444baabe-5d03-49cf-8373-9de3f9f9c451	10f488ae-e546-407e-ad82-96efb18466c6	c21fb6372b3d2acbf42bd1cb367728c1f45df1e194ea385eb2e0cc438639e456	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 18:09:01.747289+00	2026-09-02 18:09:01.747288+00	2026-08-26 18:37:36.723646+00
ec29bc4e-1c53-4adc-8928-b86d05518c35	8700aec8-b351-4e33-845e-8254918e00ad	7a135a693ef4c8803cb08355cac418d60c5f24299699c02dd636a984359d779b	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 17:58:51.915961+00	2026-09-02 17:58:51.915933+00	2026-08-26 18:43:29.851839+00
5c792464-8d73-424e-888c-9a105d37d509	10f488ae-e546-407e-ad82-96efb18466c6	9708e6681327c91b4840211fe04c27dbe4def51eb3181a1987d45951da276d92	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 18:37:36.7268+00	2026-09-02 18:37:36.726798+00	2026-08-26 18:53:39.375762+00
9745833d-9f08-4c33-81f0-e1e3e0cbb174	8700aec8-b351-4e33-845e-8254918e00ad	62b104e00f89726ed18418dbcd7a7b489d19ecc7c315d2a48542c1e80e1c009f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 18:43:29.853389+00	2026-09-02 18:43:29.853388+00	2026-08-26 22:10:09.509505+00
5cc78d4e-7ce7-48ff-ba72-6c025b3bb8f0	ae2e7050-4bc6-407b-b670-98d82a215b9b	b585c283c18abc122d73ef59ca42ea2ba1e86e99752445523e662dfef007f68a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 18:02:54.84794+00	2026-09-02 18:02:54.847939+00	2026-08-27 12:05:25.977165+00
780c513c-653f-4070-b9ad-e3a28e95ef5c	10f488ae-e546-407e-ad82-96efb18466c6	7c932e6800c7e9fb1f8c360b06ef38bedab5f40146567a2ccd64161a61b3fe94	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 18:53:39.378501+00	2026-09-02 18:53:39.3785+00	2026-08-26 19:10:59.550664+00
158c26ce-feb9-44a5-adee-cb218d2a8385	1bb14759-9967-4d6c-8a65-91e91731f726	50f6eb09489776761c65af53e61343b866e0f7fb1e062c02fadc6ca002592986	curl/8.21.0	172.18.0.1	2026-08-26 22:58:02.621979+00	2026-09-02 22:58:02.621963+00	\N
478d046a-4d74-41d5-bb1e-cd6f474c9990	8700aec8-b351-4e33-845e-8254918e00ad	01c6e8aece9e8e08292bb631a7b40de6fa841020e3dffd3ab08e766a9230e4a6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 22:10:09.513265+00	2026-09-02 22:10:09.513264+00	2026-08-26 23:17:08.375566+00
7dd2bdc0-dca8-46b9-a42c-0689c2d8767d	10f488ae-e546-407e-ad82-96efb18466c6	72f55b5a6cef4409db8945fa1a7b0b6de3e9d7d367cc7907b59e321cebbc9ba6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-26 19:10:59.557655+00	2026-09-02 19:10:59.557653+00	2026-08-27 07:57:27.201868+00
42c3713c-19ae-4ae0-a4f5-527fe9f49031	8700aec8-b351-4e33-845e-8254918e00ad	d0002e7060bbf1fbf69fbff8340534d7ca05d08d821ea848b1cad92f519baf81	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-26 23:17:08.392996+00	2026-09-02 23:17:08.392994+00	2026-08-27 08:05:28.019071+00
ca1fcf42-1823-4612-b946-3f7a8130f27c	1bb14759-9967-4d6c-8a65-91e91731f726	402e332a6477c0ad36d64f81b7fe32c19704fca54fe8b10e0bdcb5ff40db6a77	curl/8.21.0	172.18.0.1	2026-08-27 08:26:27.269314+00	2026-09-03 08:26:27.269264+00	\N
07f95c6f-3c28-4698-aadd-d2b98f6f8b12	8700aec8-b351-4e33-845e-8254918e00ad	fa8fe2fb9dc7ae83d293be22ef82e0de6d6b00a89bad25c6efe518d9b0119782	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 08:05:28.025133+00	2026-09-03 08:05:28.025065+00	2026-08-27 08:46:06.359042+00
dd3085f9-a52e-48a6-bf4a-015eacd8215f	10f488ae-e546-407e-ad82-96efb18466c6	56a5d33a7ed1af1694848c7b77a0c60b08039f5c786450368f092144017b851f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 07:57:27.212626+00	2026-09-03 07:57:27.212625+00	2026-08-27 08:47:25.805577+00
788cc3a9-475a-4386-baef-88830a51a910	10f488ae-e546-407e-ad82-96efb18466c6	d98ac4950904473977f53ca394a6f93cc5a12a1daa31aaeef7f0cfe79ef6e01f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 08:47:25.80727+00	2026-09-03 08:47:25.807269+00	2026-08-27 09:18:55.368795+00
2e180888-9211-4839-9158-9c7ffc28422b	10f488ae-e546-407e-ad82-96efb18466c6	9621b977539e3464ded00ae13c6223a3e9df93e69a48e42c9b4a4461d5370191	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 09:18:55.375242+00	2026-09-03 09:18:55.375242+00	2026-08-27 10:04:09.119473+00
918ab722-f537-403e-a026-d537d670389e	10f488ae-e546-407e-ad82-96efb18466c6	294578a1d86cab0363f2d1b3bccc33a558ff6b5d8960218046a2de49c4350362	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 10:04:09.127194+00	2026-09-03 10:04:09.127193+00	2026-08-27 10:39:03.064244+00
bef493a2-b93e-44d9-9dfa-25102f1ae017	10f488ae-e546-407e-ad82-96efb18466c6	301ca8f7c0cbbf1b6e9448dd2fa9112f48f093522343d9873355499e16177348	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 10:39:03.069596+00	2026-09-03 10:39:03.069594+00	2026-08-27 11:00:55.379535+00
20ac1e67-cd06-43b7-9ed6-e114186b74cc	8700aec8-b351-4e33-845e-8254918e00ad	eb9ef271a0fb101906cd0d4dd387fa4e76f4d63c8df4d2f32cbcae4014838c50	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 08:46:06.363032+00	2026-09-03 08:46:06.363031+00	2026-08-27 11:08:43.183995+00
3bec36c2-4de0-4e47-8631-671c31d3dc85	10f488ae-e546-407e-ad82-96efb18466c6	5253c2675152e47c65a2920aa4bcea482cc5b81d7f8d97b435b0dc735102cae1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 11:00:55.390787+00	2026-09-03 11:00:55.390785+00	2026-08-27 11:20:41.501217+00
8eac0026-f24f-4251-be28-855951c68211	8700aec8-b351-4e33-845e-8254918e00ad	f8d5bc94b642a8d08fd5c62b08ebe1cd4738c14661c3846853048f91fb80c3d6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 11:08:43.189005+00	2026-09-03 11:08:43.189004+00	2026-08-27 11:32:14.708383+00
a4f98016-f716-41af-9182-51d1c8b1179c	8700aec8-b351-4e33-845e-8254918e00ad	5d84d172b14cd4238735b5532d3ad1f76442992e6b34ac9b420616cee9f5a5ae	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 11:32:14.71251+00	2026-09-03 11:32:14.712508+00	2026-08-27 11:51:36.134693+00
c9bb5533-7c14-43f8-a22e-32ca85eed060	ae2e7050-4bc6-407b-b670-98d82a215b9b	65ff0109db59afbd8acc6908d5c856e7c743f7b54bab453370eba2526cc12543	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 12:05:25.979414+00	2026-09-03 12:05:25.979413+00	\N
107fa7ec-8e61-4b7e-9fb6-d7836b4098e8	10f488ae-e546-407e-ad82-96efb18466c6	48ea091a3810008f5f56246cc3f5512dca0a521078f26f105bb4672b68d86a00	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 11:20:41.508653+00	2026-09-03 11:20:41.508651+00	2026-08-27 12:08:54.044276+00
b6585ca5-bace-49d9-9229-687d4477594c	10f488ae-e546-407e-ad82-96efb18466c6	1bc3fbf3b7597b06cf570512f21f3ee8a9c36c608fc5e4965f1a82a07c5eec24	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 12:08:54.046883+00	2026-09-03 12:08:54.046882+00	\N
a19a391c-9743-45a4-a676-45af9148fdaa	10f488ae-e546-407e-ad82-96efb18466c6	3b6fbd10d4bc8eb8c73fa473c3310ff2c63f246df4ad0b99793a84896edc8f02	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	172.18.0.1	2026-08-27 12:09:48.778129+00	2026-09-03 12:09:48.778127+00	\N
405254d1-119d-4b95-a2af-40ede6fee36c	8700aec8-b351-4e33-845e-8254918e00ad	1282479ff50416f1c021a4a1023aa02cb59bf184d122c254cb2f83637a3098bb	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 11:51:36.1383+00	2026-09-03 11:51:36.138299+00	2026-08-27 12:29:12.843055+00
3216f446-8f39-405f-969f-f9792a7c9d1d	8700aec8-b351-4e33-845e-8254918e00ad	88d28ec039ba96774bbf851ef7c394f0b2b8f667f251427669a447c9296642e1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.37937.1 Chrome/148.0.7778.280 Safari/537.36 MSIX	172.18.0.1	2026-08-27 12:29:12.846466+00	2026-09-03 12:29:12.846465+00	\N
\.


--
-- Data for Name: review_helpful_votes; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.review_helpful_votes (review_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: review_history; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.review_history (id, review_id, old_rating, new_rating, old_comment, new_comment, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: review_replies; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.review_replies (id, review_id, user_id, body, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.schema_migrations (version, applied_at) FROM stdin;
001_create_users.sql	2026-08-15 08:38:58.806054
002_create_activation_tokens.sql	2026-08-15 08:38:58.849758
003_create_refresh_tokens.sql	2026-08-15 08:38:58.878729
004_create_businesses.sql	2026-08-15 08:38:58.908569
005_create_business_memberships.sql	2026-08-15 08:38:59.015269
006_create_shops.sql	2026-08-16 00:49:33.41851
007_create_employees.sql	2026-08-16 00:49:33.477077
008_create_employee_shop_assignments.sql	2026-08-16 00:49:33.506344
009_create_products.sql	2026-08-16 00:49:33.533474
010_create_inventory.sql	2026-08-16 00:49:33.561095
011_create_stock_movements.sql	2026-08-16 00:49:33.587717
012_add_product_variants.sql	2026-08-16 01:06:43.983694
013_add_stock_receipts.sql	2026-08-16 01:06:44.051612
014_add_orders.sql	2026-08-16 01:46:05.089541
015_add_stock_movements_indexes.sql	2026-08-16 02:19:02.3147
016_add_customers.sql	2026-08-16 02:59:31.492724
017_add_cash_tracking.sql	2026-08-16 03:51:55.173281
018_add_buyer_side_points_growth.sql	2026-08-16 07:37:23.860214
019_add_categories_and_publication.sql	2026-08-16 17:50:16.282686
020_add_point_redemption_and_buyer_orders.sql	2026-08-17 09:13:24.855607
021_buyer_levels_restructure_and_config.sql	2026-08-18 13:56:28.564954
022_add_delivery_and_buyer_payments.sql	2026-08-18 13:56:28.69461
023_add_order_tracking.sql	2026-08-18 15:59:05.531649
024_add_seller_reviews.sql	2026-08-18 17:12:04.258084
025_add_account_type_to_users.sql	2026-08-20 10:53:01.877094
026_create_employee_invitations.sql	2026-08-20 10:53:01.905101
027_create_employee_activation_tokens.sql	2026-08-20 10:53:01.93634
028_drop_inventory_shop_product_unique.sql	2026-08-21 00:02:13.331051
029_create_password_reset_tokens.sql	2026-08-21 10:16:18.813952
030_create_product_images.sql	2026-08-22 00:13:51.805998
031_add_product_reviews_social.sql	2026-08-24 15:02:08.412308
032_separate_product_service_reviews.sql	2026-08-24 20:43:04.6532
033_add_buyer_profile_contact_fields.sql	2026-08-25 08:24:19.123332
034_add_discounts_and_claimed_flags.sql	2026-08-26 12:05:35.154799
035_link_product_images_to_variants.sql	2026-08-26 17:03:09.258765
036_add_product_review_aggregates.sql	2026-08-26 22:57:09.086565
\.


--
-- Data for Name: seller_levels; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.seller_levels (id, name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description, created_at) FROM stdin;
7ccce069-ee5c-42fc-8586-e965e88f2071	STARTER	0	499	0.00	f	f	Normal marketplace presence	2026-08-16 07:37:23.860214
f5d97f72-db0b-40ad-a054-a17b30619284	ACTIVE	500	1999	0.10	f	f	Small search ranking boost	2026-08-16 07:37:23.860214
3e1f9f48-fe1d-4ef0-984d-5a4f60104cb4	PRO	2000	4999	0.25	t	f	Higher search boost, recommendation eligible	2026-08-16 07:37:23.860214
6d882a8f-ea8e-47ad-bd25-1775a54521e7	ELITE	5000	9999	0.50	t	f	Stronger recommendation exposure, higher visibility	2026-08-16 07:37:23.860214
141fb0d7-b97d-442d-be8b-05948a436b3d	PREMIUM	10000	99999999	1.00	t	t	Maximum organic visibility boost, priority recommendation eligibility	2026-08-16 07:37:23.860214
\.


--
-- Data for Name: seller_reviews; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.seller_reviews (id, order_id, buyer_profile_id, business_id, shop_id, rating, comment, verified_purchase, status, created_at, updated_at, product_id, order_line_id, variant_id, delivery_rating, service_rating, order_experience_rating) FROM stdin;
a1a51196-7a49-4a5e-aa4e-1da1f3884c22	89b0f950-c5fe-4059-b23d-987a88eeddaa	4364cacd-338e-4bcf-ae7d-b8f21a857fb9	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	5	Great service, fast pickup!	t	ACTIVE	2026-08-21 03:54:01.630062+00	2026-08-21 03:54:01.630062+00	\N	\N	\N	\N	\N	\N
b7e3d02c-8bd1-4b44-81fe-f11ff447c5db	8ec221fe-1463-45a3-82a7-9c8bd645326b	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	5	Great service, fast pickup!	t	ACTIVE	2026-08-21 04:16:20.019041+00	2026-08-21 04:16:20.019041+00	\N	\N	\N	\N	\N	\N
ab213442-481a-4d5d-a7c9-c21f093ab771	93e8de5a-2b9b-4b98-b968-8a15369789eb	5fa6e0ec-098a-417d-856f-187eb5aeaa4b	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	5	Tres bonne chaussure, taille bien.	t	ACTIVE	2026-08-26 22:58:03.292895+00	2026-08-26 22:58:03.292895+00	497354c6-1272-48fd-b975-587a23f204e4	b3176e4a-134f-484a-b4a7-d200f9cba15e	11145bb0-ede0-4981-b683-a8def97c26ef	\N	\N	\N
\.


--
-- Data for Name: seller_trust; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.seller_trust (id, business_id, trust_status, verified_sales_count, order_completion_rate, cancellation_rate, purchase_confirmation_rate, stock_reliability_rate, last_calculated_at, created_at, updated_at) FROM stdin;
c54aa3f7-a38a-4b1a-9ded-15896b3d2a18	60555b41-17c0-4214-8109-9c456e54c8ee	NORMAL	4	100.00	0.00	25.00	100.00	2026-08-25 08:01:47.275473	2026-08-21 04:16:10.440678	2026-08-25 08:01:47.275473
f0d37a15-d185-41a5-86db-61d00c16ff0f	f09a416f-601e-4666-b24b-9a7e0adbed1e	LOW	0	0.00	0.00	0.00	100.00	\N	2026-08-25 08:14:49.206277	2026-08-25 08:14:49.206277
7da8a099-0eb6-4d2b-81fd-b0149ba06e3d	34f536ff-c14c-4a57-a933-930518d428e2	LOW	1	0.00	0.00	0.00	100.00	2026-08-26 11:06:38.86854	2026-08-21 14:11:27.003662	2026-08-26 11:06:38.86854
ceb58a94-466b-4a96-82d5-5d5f8f6ebffe	f5bbc830-34b8-45a0-b50d-b16b0a362689	NORMAL	2	50.00	0.00	0.00	100.00	2026-08-26 13:26:45.228494	2026-08-26 13:26:42.479293	2026-08-26 13:26:45.228494
ea791690-1fe0-46fb-9926-583e2d18815f	1ba51d3e-52e7-40ec-878d-55a7d135bdad	NORMAL	2	50.00	0.00	0.00	100.00	2026-08-26 13:28:17.566947	2026-08-26 13:28:15.296684	2026-08-26 13:28:17.566947
2c3ca0a6-9c8f-451b-bbfc-398e3bbb349f	28158bd6-cd39-49a8-a0a9-58ec324473bc	NORMAL	1	100.00	0.00	0.00	100.00	2026-08-26 22:58:03.67365	2026-08-26 15:55:26.244833	2026-08-26 22:58:03.67365
4ad3e769-ecfb-4d3b-b7fe-9a4f642f0fc0	50afee23-0ac7-4bbd-96b2-ec28eea43751	LOW	0	0.00	0.00	0.00	100.00	\N	2026-08-21 11:53:53.573934	2026-08-21 11:53:53.573934
f7027298-99bc-4e60-ba8a-8dad49b88947	13193bb5-b17f-4097-ba81-43005ad5c416	LOW	0	0.00	0.00	0.00	100.00	\N	2026-08-22 00:40:24.371476	2026-08-22 00:40:24.371476
08fb27be-7807-4ad5-8090-596b9d4e20fc	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	LOW	0	0.00	0.00	0.00	100.00	\N	2026-08-22 01:07:05.304645	2026-08-22 01:07:05.304645
10a3f81d-87c2-486b-bdbe-82a0e355536f	91eb7ec0-476f-41f3-9845-af89f864f129	NORMAL	2	100.00	0.00	50.00	100.00	2026-08-25 07:33:04.115906	2026-08-21 03:53:51.011496	2026-08-25 07:33:04.115906
\.


--
-- Data for Name: shop_review_aggregates; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.shop_review_aggregates (shop_id, average_rating, total_reviews, rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count, last_review_at, updated_at) FROM stdin;
1de90a97-8fe4-4b43-abbc-19dddc868239	5.00	1	0	0	0	0	1	2026-08-21 04:16:20.019041+00	2026-08-24 20:43:04.6532+00
3e481b8f-a664-4a3f-a77e-e684dde6b2bd	5.00	1	0	0	0	0	1	2026-08-21 03:54:01.630062+00	2026-08-24 20:43:04.6532+00
323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	0.00	0	0	0	0	0	0	\N	2026-08-26 22:58:03.634078+00
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.shops (id, business_id, name, type, city, address, phone, status, created_at, updated_at, supports_shop_delivery, shop_delivery_fee, supports_partner_delivery, partner_delivery_fee, partner_delivery_provider, delivery_city, delivery_address) FROM stdin;
3e481b8f-a664-4a3f-a77e-e684dde6b2bd	91eb7ec0-476f-41f3-9845-af89f864f129	Shop A 045337	PHYSICAL	Kinshasa	12 Av. Market	+243811000001	ACTIVE	2026-08-21 03:53:42.206186+00	2026-08-21 03:53:42.206186+00	t	2000.00	f	0.00			
980a2507-dbe6-4d1f-8b18-6339ac1913be	91eb7ec0-476f-41f3-9845-af89f864f129	Shop B 045337	PHYSICAL	Lubumbashi	5 Rd. Commerce	+243811000002	ACTIVE	2026-08-21 03:53:42.218586+00	2026-08-21 03:53:42.218586+00	f	0.00	f	0.00			
75d82676-f7a1-4051-8e8e-58672fafd45d	935a6a34-0db0-46c6-887b-694593b428b6	BizB Shop 045337	PHYSICAL	Goma	1 St	+243855000001	ACTIVE	2026-08-21 03:53:54.416708+00	2026-08-21 03:53:54.416708+00	f	0.00	f	0.00			
96d54d38-7723-46e4-8573-b8bfc1ef5732	25bb7d25-9c0d-44ca-8b9c-6f21fbbdff78	BizB Shop 051556	PHYSICAL	Goma	1 St	+243855000001	ACTIVE	2026-08-21 04:16:13.191747+00	2026-08-21 04:16:13.191747+00	f	0.00	f	0.00			
a372e99f-0dce-47eb-982b-1d28eb17a256	bab467a1-e9e0-4ea3-a359-457abbd06c79	Gombe Flagship Store	PHYSICAL	Kinshasa	14 Avenue de la Paix, Gombe	+243819822494	ACTIVE	2026-08-21 11:51:27.927042+00	2026-08-21 11:51:27.927042+00	t	5.00	f	0.00			
9a6760d2-8c80-4836-8fb1-2573f37417d3	50afee23-0ac7-4bbd-96b2-ec28eea43751	Gombe Flagship Store	PHYSICAL	Kinshasa	14 Avenue de la Paix, Gombe	+243819938032	ACTIVE	2026-08-21 11:53:47.704553+00	2026-08-21 11:53:47.704553+00	t	5.00	f	0.00			
801e63b5-586b-4bcf-bfa9-f2a673aa10a8	53b8d3b9-f8dd-4337-8719-97edc9e449b5	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819452386	ACTIVE	2026-08-21 11:54:28.590648+00	2026-08-21 11:54:28.590648+00	f	0.00	f	0.00			
c3f436d6-7206-4032-ac9f-db0cfe52c44c	c87d9849-bca1-4328-abe3-793233aadf36	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819313935	ACTIVE	2026-08-21 14:02:57.682356+00	2026-08-21 14:02:57.682356+00	f	0.00	f	0.00			
034cee4a-9ff0-4f57-ab46-c4293f4cc0ca	b67bd1b2-d12a-486b-a287-82f120598b7c	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819359250	ACTIVE	2026-08-21 14:09:19.779328+00	2026-08-21 14:09:19.779328+00	f	0.00	f	0.00			
c88305b5-74ca-4761-9775-a8aac15f29f4	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819748882	ACTIVE	2026-08-21 14:10:27.893404+00	2026-08-21 14:10:27.893404+00	f	0.00	f	0.00			
90a387f4-deca-4cc4-addb-ad02323f4084	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819697954	ACTIVE	2026-08-21 14:13:07.148456+00	2026-08-21 14:13:07.148456+00	f	0.00	f	0.00			
cf7dd5b8-fe99-4279-8552-ed772da25b43	aacea673-e33b-4e03-9a1d-a59c899ac662	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819882763	ACTIVE	2026-08-21 14:13:54.667493+00	2026-08-21 14:13:54.667493+00	f	0.00	f	0.00			
046d278c-9140-4b89-9055-4024789f9e35	34f536ff-c14c-4a57-a933-930518d428e2	Beauty	ONLINE	kinshasa	Maihandre 12	243989805614	ACTIVE	2026-08-21 14:25:49.866092+00	2026-08-21 14:25:49.866092+00	f	0.00	f	0.00			
34c98649-b1f3-416f-a1d8-3e5c3094926f	704df200-1059-4f70-bfef-084c61675633	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819395420	ACTIVE	2026-08-21 14:27:48.494136+00	2026-08-21 14:27:48.494136+00	f	0.00	f	0.00			
57ccb6cb-92a9-4acc-ad5e-27ca5bfd96b8	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	Order Test Shop	PHYSICAL	Kinshasa	Main Street	+243819176734	ACTIVE	2026-08-21 14:28:52.600816+00	2026-08-21 14:28:52.600816+00	f	0.00	f	0.00			
ca60ee2a-61d8-435f-9108-67e9eb031e94	75c1e6d2-75f0-4116-88d4-ac684bda3c49	Main Boutique	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 22:47:39.395107+00	2026-08-21 22:47:39.395107+00	f	0.00	f	0.00			
b7f43f8f-56cf-415e-8605-9d34f4b1854b	75c1e6d2-75f0-4116-88d4-ac684bda3c49	Gombe Branch	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 22:47:39.401926+00	2026-08-21 22:47:39.401926+00	f	0.00	f	0.00			
7c48c03e-bbd5-47ce-a847-0c69b4b02550	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	Main Boutique	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:00:01.34164+00	2026-08-21 23:00:01.34164+00	f	0.00	f	0.00			
fc8cd092-835b-4a2c-9108-62554663a205	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	Gombe Branch	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:00:01.352703+00	2026-08-21 23:00:01.352703+00	f	0.00	f	0.00			
65388ab2-1828-42ff-b002-d7f5af9f3c05	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	Main Boutique	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:02:18.381674+00	2026-08-21 23:02:18.381674+00	f	0.00	f	0.00			
ab4e24a3-bcbc-44b9-8116-8afcff1c37a1	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	Gombe Branch	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:02:18.391033+00	2026-08-21 23:02:18.391033+00	f	0.00	f	0.00			
0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	db8af7ab-c951-44ff-8445-0f2a4bad9b65	Main Boutique	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:06:24.154556+00	2026-08-21 23:06:24.154556+00	f	0.00	f	0.00			
ab6152c8-7827-4b63-8ea4-7ef4218b514f	db8af7ab-c951-44ff-8445-0f2a4bad9b65	Gombe Branch	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:06:24.162403+00	2026-08-21 23:06:24.162403+00	f	0.00	f	0.00			
5825d4ab-210b-48dc-8e77-bd12d4195466	4c266dc8-d833-48bf-831f-fdf5b3e089b6	Main Boutique	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:08:34.794185+00	2026-08-21 23:08:34.794185+00	f	0.00	f	0.00			
499fbc66-186d-45a2-bf27-2122e20c7947	4c266dc8-d833-48bf-831f-fdf5b3e089b6	Gombe Branch	PHYSICAL	Kinshasa			ACTIVE	2026-08-21 23:08:34.803032+00	2026-08-21 23:08:34.803032+00	f	0.00	f	0.00			
9239d434-08e4-44b9-ba04-5e91a1aba9eb	13193bb5-b17f-4097-ba81-43005ad5c416	Limete Shop	PHYSICAL	Kinshasa	Limete	+243988776652	ACTIVE	2026-08-22 00:18:09.185066+00	2026-08-22 00:18:09.185066+00	f	0.00	f	0.00			
803aeb85-7472-4f6e-b7fa-410e97ca7d92	5eaaa271-4fcd-492b-8e57-40b2dc4a72e7	Deborah's Kabelo	ONLINE	Kinshasa	mutangire 19	989805614	ACTIVE	2026-08-22 00:53:57.405668+00	2026-08-22 00:53:57.405668+00	f	0.00	f	0.00			
323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	28158bd6-cd39-49a8-a0a9-58ec324473bc	Test Shop Verify	PHYSICAL	Kinshasa	123 Test Ave	+243900000113	ACTIVE	2026-08-26 15:55:26.001998+00	2026-08-26 16:01:12.929706+00	t	5.00	f	0.00		Kinshasa	123 Test Ave
49c1cd3a-3407-4dbb-bf22-095648bee580	13193bb5-b17f-4097-ba81-43005ad5c416	Gombe Shop	PHYSICAL	Kinshasa	Gombe	+243988776651	ACTIVE	2026-08-22 00:18:09.178942+00	2026-08-22 01:06:36.677488+00	f	0.00	f	0.00			
fc37b990-a26f-4729-bb83-fd9918712e03	34f536ff-c14c-4a57-a933-930518d428e2	Debolife	ONLINE	Kinshasa	mutangire 19	989805614	ACTIVE	2026-08-22 01:13:13.150077+00	2026-08-22 01:13:13.150077+00	f	0.00	f	0.00			
1de90a97-8fe4-4b43-abbc-19dddc868239	60555b41-17c0-4214-8109-9c456e54c8ee	Shop A 051556	PHYSICAL	Kinshasa	12 Av. Market	+243811000001	INACTIVE	2026-08-21 04:16:01.339851+00	2026-08-25 08:14:49.077442+00	t	2000.00	f	0.00			
d2cbe943-bbf3-40ea-9767-1b70708cc3d1	60555b41-17c0-4214-8109-9c456e54c8ee	Shop B 051556	PHYSICAL	Lubumbashi	5 Rd. Commerce	+243811000002	INACTIVE	2026-08-21 04:16:01.353943+00	2026-08-25 08:14:49.077442+00	f	0.00	f	0.00			
422180d1-4773-441d-90db-f989ea1df09b	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	Gombe Shop	PHYSICAL	Kinshasa	12 Av. Gombe	+243811000100	ACTIVE	2026-08-26 13:19:07.158831+00	2026-08-26 13:19:07.158831+00	t	2000.00	f	0.00			
c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	f5bbc830-34b8-45a0-b50d-b16b0a362689	Gombe Shop	PHYSICAL	Kinshasa	12 Av. Gombe	+243811000100	ACTIVE	2026-08-26 13:26:41.046956+00	2026-08-26 13:26:41.046956+00	t	2000.00	f	0.00			
ff89f500-aa1c-419b-82e5-6faffdf7ae3a	1ba51d3e-52e7-40ec-878d-55a7d135bdad	Gombe Shop	PHYSICAL	Kinshasa	12 Av. Gombe	+243811000100	ACTIVE	2026-08-26 13:28:13.497056+00	2026-08-26 13:28:13.497056+00	t	2000.00	f	0.00			
03e39c93-f443-4c5a-8958-46c0a44f42c7	f25f43bd-ab50-4b87-b053-40a6af262d5b	Prod Shop	PHYSICAL	Kinshasa	1 Test	+243811000300	ACTIVE	2026-08-26 15:20:09.265574+00	2026-08-26 15:20:09.265574+00	t	1000.00	f	0.00			
2a57279c-cc2f-4656-9de5-6ff936e27640	65a47cfd-4a86-4a1c-beab-63c72c97747c	Prod Shop	PHYSICAL	Kinshasa	1 Test	+243811000300	ACTIVE	2026-08-26 15:21:26.163373+00	2026-08-26 15:21:26.163373+00	t	1000.00	f	0.00			
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.stock_movements (id, business_id, shop_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_id, notes, performed_by, employee_id, created_at, variant_id) FROM stdin;
acfaa5a3-eabf-4219-b614-b16c3bcb2812	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	STOCK_IN	10	0	10	\N		4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:42.385052+00	fec4d682-103b-41e8-90cc-ec40edd3e599
a9584e96-61df-4207-ae83-3db03c8a0308	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	SALE_PHYSICAL	-2	10	8	\N		4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:42.450621+00	fec4d682-103b-41e8-90cc-ec40edd3e599
e9aed08a-13c7-4014-9476-c4c29fa694cc	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	STOCK_IN	1	0	1	\N		4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:42.548546+00	91a9851b-fa50-4949-b766-f9ebd1cb3b96
c4d3b5cf-63b9-4281-9bee-bc80cb013754	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	SALE_PHYSICAL	-1	1	0	\N		4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:46.50474+00	91a9851b-fa50-4949-b766-f9ebd1cb3b96
0816faa8-d80d-4ec0-9496-abb6abb60ee0	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	SALE_ONLINE	-1	8	7	\N	Order 39f14eb2-a16b-44fe-a546-2701fee2b128 completed	4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:51.319254+00	fec4d682-103b-41e8-90cc-ec40edd3e599
6e9e6153-4af7-43d9-ace1-f8663897632a	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	STOCK_IN	3	7	10	\N		1a71c2be-c812-4d18-8291-e8cc3b43e017	\N	2026-08-21 03:53:53.146825+00	fec4d682-103b-41e8-90cc-ec40edd3e599
61b0bd8d-5362-4962-86b9-d2355e43dcb9	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	SALE_PHYSICAL	-1	10	9	\N		1a71c2be-c812-4d18-8291-e8cc3b43e017	06c2aad0-5165-4047-8fba-eff5bfff0924	2026-08-21 03:53:53.183135+00	fec4d682-103b-41e8-90cc-ec40edd3e599
55434f64-1e07-4791-99a8-b790978c0cb6	91eb7ec0-476f-41f3-9845-af89f864f129	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	cb69da3a-bef2-44aa-84c3-636df0200d81	STOCK_IN	20	9	29	\N		4ad3d1d8-8224-48e3-a15f-efd114544a97	\N	2026-08-21 03:53:55.434589+00	fec4d682-103b-41e8-90cc-ec40edd3e599
07d78405-ea0a-4b6a-a793-10a79285e1fb	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	STOCK_IN	10	0	10	\N		00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:01.583511+00	693e071f-962d-482e-92b0-872d35d1586c
3ae6b416-1c95-4da5-ba63-84ed217cd404	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	SALE_PHYSICAL	-2	10	8	\N		00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:01.655896+00	693e071f-962d-482e-92b0-872d35d1586c
200e88dd-8a9a-477f-a6be-12521c7ffdee	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	STOCK_IN	1	0	1	\N		00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:01.846879+00	1c15bd3a-b1bd-4279-a951-7eeae218315a
712a8e6c-5d8b-4191-af6b-fefc83b772c4	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	SALE_PHYSICAL	-1	1	0	\N		00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:06.849901+00	1c15bd3a-b1bd-4279-a951-7eeae218315a
09d63409-3c7b-4f38-bc80-3dacbf87b9f5	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	SALE_ONLINE	-1	8	7	\N	Order 0bd192ee-550f-477c-bdd5-ba890b037d48 completed	00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:10.568839+00	693e071f-962d-482e-92b0-872d35d1586c
b195a111-a9b5-42b5-97bd-f8c741aa3716	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	STOCK_IN	3	7	10	\N		ddabcdf3-c71d-4b0a-8493-96ee7f68bdc9	\N	2026-08-21 04:16:12.240732+00	693e071f-962d-482e-92b0-872d35d1586c
c87ce715-8796-4103-ab15-22571d50e91f	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	SALE_PHYSICAL	-1	10	9	\N		ddabcdf3-c71d-4b0a-8493-96ee7f68bdc9	2115d04d-f76c-4646-a973-40bb97bf3809	2026-08-21 04:16:12.259511+00	693e071f-962d-482e-92b0-872d35d1586c
3710ece6-f764-4d57-a57b-5f746e28fd3f	60555b41-17c0-4214-8109-9c456e54c8ee	1de90a97-8fe4-4b43-abbc-19dddc868239	a92c35f3-5520-4269-b178-bc9cf568ba25	STOCK_IN	20	9	29	\N		00c2d92b-4a5a-4000-b15b-a888d217f4c9	\N	2026-08-21 04:16:14.052127+00	693e071f-962d-482e-92b0-872d35d1586c
3ce8550b-2bfb-4c90-adf6-ff476fa51e9d	bab467a1-e9e0-4ea3-a359-457abbd06c79	a372e99f-0dce-47eb-982b-1d28eb17a256	8c1f8d4b-d0f7-46f5-8cfb-8d8cd344e43b	STOCK_IN	30	0	30	\N	Initial warehouse inbound shipment	a0de438d-d002-40e3-bbf8-4f6db93d2806	\N	2026-08-21 11:51:28.830039+00	75e13a20-ebc4-4ded-84e0-3e5f041b7632
7a45c570-7690-4e45-97e1-ca2ae7a7c203	50afee23-0ac7-4bbd-96b2-ec28eea43751	9a6760d2-8c80-4836-8fb1-2573f37417d3	3004215d-01d4-49d4-97b6-5da83aad569d	STOCK_IN	30	0	30	\N	Initial warehouse inbound shipment	deff6045-e0b5-4005-8333-9c22e88edc61	\N	2026-08-21 11:53:48.67886+00	1f61c123-ce27-463b-928b-53b21233b975
2ae5d444-8e31-4a10-97cd-973a98e957c0	53b8d3b9-f8dd-4337-8719-97edc9e449b5	801e63b5-586b-4bcf-bfa9-f2a673aa10a8	f67232b9-af8b-434d-a175-477e009368e2	STOCK_IN	10	0	10	\N	Initial stock	e271741f-799d-49b0-ac63-8e382d67fc6c	\N	2026-08-21 11:54:28.62297+00	177ea894-762c-469a-b404-9e5dfe9347d1
0f9b3bd3-686f-4c7a-9083-c706cbef1c6f	c87d9849-bca1-4328-abe3-793233aadf36	c3f436d6-7206-4032-ac9f-db0cfe52c44c	b686a6eb-5ae0-496b-a720-0e76b80d2990	STOCK_IN	10	0	10	\N	Initial stock	dec18fe0-92d5-4faf-98db-9c5d615fdace	\N	2026-08-21 14:02:57.708116+00	7234b66b-abbc-4dc6-96aa-ef89d965b36a
67bdbc6f-4a80-41f1-a1ea-3ec16bab968c	b67bd1b2-d12a-486b-a287-82f120598b7c	034cee4a-9ff0-4f57-ab46-c4293f4cc0ca	404e9442-0a60-4126-8ac6-24a6ec4beffe	STOCK_IN	10	0	10	\N	Initial stock	dae3304d-d7b9-46e0-adb4-0f7b023a9500	\N	2026-08-21 14:09:19.802747+00	33de05da-3de1-4d82-9c8e-e8e07e539f3e
9d64b2c7-09fc-41fa-a27a-ad003e78a535	2a94d6d1-0b37-4324-9648-d2f12b4ffb43	c88305b5-74ca-4761-9775-a8aac15f29f4	c88211fc-ff19-4b63-aac0-378b6006accd	STOCK_IN	10	0	10	\N	Initial stock	c18774e1-d8f5-40f5-8582-f2b9b55912e7	\N	2026-08-21 14:10:27.906735+00	6581e9b3-4b01-4bcb-a6a9-e5a88836d46e
a9799229-e681-425f-8f59-fb526d0b4a34	074fab6d-e5c0-434c-adf8-cb9fb4c49f97	90a387f4-deca-4cc4-addb-ad02323f4084	bb0ec843-3988-4025-80c7-42da08bf647f	STOCK_IN	10	0	10	\N	Initial stock	90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	\N	2026-08-21 14:13:07.167581+00	06c2f300-7e95-4ba3-baa4-edf438115a5d
47fb351f-3d53-4b76-bbf9-af0c75c79441	aacea673-e33b-4e03-9a1d-a59c899ac662	cf7dd5b8-fe99-4279-8552-ed772da25b43	6810ebca-5c7e-4189-8418-a8b6b81096cb	STOCK_IN	10	0	10	\N	Initial stock	d31867cb-cc3e-49c6-ba4c-04d10901255b	\N	2026-08-21 14:13:54.684401+00	6b083dfa-4c1a-4348-a10b-09b75402800a
320b03a0-4e82-45b3-9694-a9034a5cc0c2	704df200-1059-4f70-bfef-084c61675633	34c98649-b1f3-416f-a1d8-3e5c3094926f	a3de5bac-a9e5-4477-b8a2-401cf10aaca5	STOCK_IN	10	0	10	\N	Initial stock	ac0622f2-f999-4bad-8a3c-fb8b97304ff3	\N	2026-08-21 14:27:48.517852+00	ce60c606-4b61-4229-90b3-edee744e95d1
94ea94af-2799-45b6-b723-0cb41a5bbeda	1ad02bec-e152-4170-b5fe-29f7aa8a1e39	57ccb6cb-92a9-4acc-ad5e-27ca5bfd96b8	65b6df58-93f5-434c-85c9-97eda93bcc2c	STOCK_IN	10	0	10	\N	Initial stock	53eabe9b-cf41-4444-a608-b08e85779c01	\N	2026-08-21 14:28:52.619236+00	d0d5a904-a30c-431b-b1fd-03a2a532fa2f
30c2c82d-bbf4-4506-b747-c345d0835bc1	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	STOCK_IN	10	0	10	\N	Initial stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-21 14:58:00.96011+00	15d87612-9934-431c-87c5-d961fc4177a8
bf9e1089-e7c1-4239-9292-faefc442efad	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	STOCK_IN	5	0	5	\N	Initial stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-21 14:58:00.984503+00	67ac0e2d-2807-4e36-b628-5bb80171a4a0
11cbf793-667d-4806-a9b0-16108fd908a5	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	STOCK_IN	3	0	3	\N	Initial stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-21 14:58:01.009216+00	bc436e11-3196-439b-8e5d-8e1a3c0a2f4a
089d1dda-ab81-4277-b85a-40b6b951cf8b	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	b126a114-7182-4368-8aab-31521247e520	STOCK_IN	25	0	25	\N	Initial stock	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:39.473865+00	b7dbb717-98c7-47cf-8e13-11d1396c4682
c1e31207-d610-4af3-94c7-32e79ebcfc4f	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	b126a114-7182-4368-8aab-31521247e520	STOCK_IN	10	25	35	\N	Restock	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:39.979368+00	b7dbb717-98c7-47cf-8e13-11d1396c4682
4e7dfdd4-d2d5-4cb8-810a-5bba6639a3dc	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	STOCK_IN	10	0	10	\N	Initial stock	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:40.341398+00	d46c924b-699a-4f1d-b740-e02eefc1f4c5
6c45fe6e-cd78-4536-9f66-8e3e096fefdf	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	STOCK_IN	5	0	5	\N	Initial stock	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:40.351789+00	074f6dc4-5507-4d0d-88ff-9c6506418dc3
92a871d1-8c08-40e6-a515-c90a811cadff	75c1e6d2-75f0-4116-88d4-ac684bda3c49	ca60ee2a-61d8-435f-9108-67e9eb031e94	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	STOCK_IN	3	0	3	\N	Initial stock	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:40.360116+00	46c25f23-409c-4b7b-8704-71cc503ca2eb
39b933c4-1bb5-450f-9305-7d78e944f6b6	75c1e6d2-75f0-4116-88d4-ac684bda3c49	b7f43f8f-56cf-415e-8605-9d34f4b1854b	fd0d403e-2cdd-4ac7-9aed-7aa41733274e	STOCK_IN	7	0	7	\N	Stock for Gombe branch	88405f91-3489-4d58-b613-296bef30e2ef	\N	2026-08-21 22:47:41.882001+00	d46c924b-699a-4f1d-b740-e02eefc1f4c5
97d684d1-5aaf-4fe1-9f33-cd18e079b41c	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	17dcb70b-f466-4c0e-9661-d0d66d24a99e	STOCK_IN	25	0	25	\N	Initial stock	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:01.553901+00	088c22d5-b539-49a0-b902-15395dc6680f
4630a42e-1014-4200-a124-6236265bcb58	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	17dcb70b-f466-4c0e-9661-d0d66d24a99e	STOCK_IN	10	25	35	\N	Restock	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:02.363191+00	088c22d5-b539-49a0-b902-15395dc6680f
4e857115-7717-4329-94c8-7c5a6f643e5e	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	STOCK_IN	10	0	10	\N	Initial stock	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:03.057528+00	3e8d12fd-1095-443a-96b2-489b75e42172
9d4927da-1274-4d33-9e62-2007916aa316	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	STOCK_IN	5	0	5	\N	Initial stock	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:03.07702+00	764c1d2c-3f16-4152-9bbe-c7d4958bee95
ef3c0ab3-8a5f-4607-99be-27ffb4f6932d	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	7c48c03e-bbd5-47ce-a847-0c69b4b02550	e7ec9354-f20c-420c-a9be-7e74a8347718	STOCK_IN	3	0	3	\N	Initial stock	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:03.093332+00	318f9648-aa93-4875-ae58-3c5a201c2af9
c50cb2b2-17b5-4b93-a2d0-232efd8e495a	24fbc8a2-22ec-4a8b-9caa-ef591a5518f1	fc8cd092-835b-4a2c-9108-62554663a205	e7ec9354-f20c-420c-a9be-7e74a8347718	STOCK_IN	7	0	7	\N	Stock for Gombe branch	6912915d-4dd3-41dd-9c46-6a0efc2afa46	\N	2026-08-21 23:00:05.869051+00	3e8d12fd-1095-443a-96b2-489b75e42172
4454c23b-b6e0-4e5f-bb45-9fff8f1ecb00	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	1fd17e3f-6d5f-40ce-938d-1d2ecb4cf30b	STOCK_IN	25	0	25	\N	Initial stock	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:18.575887+00	c5705744-a9bf-4748-88c9-be7d52058c48
566ad140-e99b-4b33-ab44-52825da8cb36	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	1fd17e3f-6d5f-40ce-938d-1d2ecb4cf30b	STOCK_IN	10	25	35	\N	Restock	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:19.510654+00	c5705744-a9bf-4748-88c9-be7d52058c48
dbd47b00-089d-40ec-91b1-1671af2a72b8	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	STOCK_IN	10	0	10	\N	Initial stock	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:20.15015+00	d186f275-a10e-4da3-ab9e-93a5c39e7c41
e7f1b113-c340-41db-9fe3-417e8565f7b9	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	STOCK_IN	5	0	5	\N	Initial stock	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:20.166096+00	624e2cdf-4dab-4b59-9c65-738fdf116353
5ae4c25c-0cbb-49d7-920f-b5d60435a2f1	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	65388ab2-1828-42ff-b002-d7f5af9f3c05	0e30738e-1e1b-4be5-8329-f42679c3960c	STOCK_IN	3	0	3	\N	Initial stock	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:20.183065+00	7bd20943-b7d5-426f-a2f2-c98dd47643cc
7ad8e73b-3666-4c7c-9d60-521c1dcde4f7	2804c218-88a9-4bf2-a3a9-dc73e6f1455d	ab4e24a3-bcbc-44b9-8116-8afcff1c37a1	0e30738e-1e1b-4be5-8329-f42679c3960c	STOCK_IN	7	0	7	\N	Stock for Gombe branch	4afcb35b-ebb0-492c-bc26-f4961e0c43da	\N	2026-08-21 23:02:22.903971+00	d186f275-a10e-4da3-ab9e-93a5c39e7c41
cf6e7193-4ed4-4728-a223-0d0f4f8d9fd3	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	d6fd5969-db07-4457-b2fd-2eece6337fba	INITIAL	25	0	25	\N	Initial stock	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:24.287542+00	2121ddfa-cbe1-4bd0-8191-92c9e3dd996e
7190d55b-486b-44e7-bea1-a59ab454aed4	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	d6fd5969-db07-4457-b2fd-2eece6337fba	STOCK_IN	10	25	35	\N	Restock	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:25.038206+00	2121ddfa-cbe1-4bd0-8191-92c9e3dd996e
baf7fef9-cfef-4d58-a57e-5739d60b3640	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	INITIAL	10	0	10	\N	Initial stock	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:25.533148+00	f2eda4f3-fc5d-4c74-80b3-092403c42d09
0a3bc117-af5c-473f-98b6-0fe66fb8db6f	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	INITIAL	5	0	5	\N	Initial stock	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:25.546801+00	1df5150e-af56-4819-b973-2ca810e8e76d
2ee1cd2c-bc9c-4edc-b7cf-24960baab8cb	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	INITIAL	3	0	3	\N	Initial stock	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:25.560351+00	324c142f-f906-44fd-b28b-331b1afdcada
36430b6b-fa51-45c6-a84a-574c142d81cc	db8af7ab-c951-44ff-8445-0f2a4bad9b65	ab6152c8-7827-4b63-8ea4-7ef4218b514f	95b682f1-307f-4142-b413-5e988f415a3f	INITIAL	7	0	7	\N	Stock for Gombe branch	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:27.645501+00	f2eda4f3-fc5d-4c74-80b3-092403c42d09
a4bb88ac-ffd6-48fc-acb9-5b6c89ff569d	db8af7ab-c951-44ff-8445-0f2a4bad9b65	0c13a8ca-78d0-4b2e-8859-e13324d1dcaf	95b682f1-307f-4142-b413-5e988f415a3f	ADJUSTMENT	-4	10	10	\N	Reserved for online order	6b7cadef-8ebe-4d0d-b219-39e7614245ff	\N	2026-08-21 23:06:27.676303+00	f2eda4f3-fc5d-4c74-80b3-092403c42d09
310d668c-6e28-4cd0-8f61-fb934835351b	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	40779f44-3065-4b9b-8b1a-c03db851d96d	INITIAL	25	0	25	\N	Initial stock	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:34.899994+00	237d1093-81ce-4d31-bbf7-72a9420b9303
b6f1899c-0832-49e7-87a2-0f6e0863f3ff	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	40779f44-3065-4b9b-8b1a-c03db851d96d	STOCK_IN	10	25	35	\N	Restock	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:35.593533+00	237d1093-81ce-4d31-bbf7-72a9420b9303
e939602c-b03e-491f-9d62-4c66b97ec035	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	INITIAL	10	0	10	\N	Initial stock	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:36.075511+00	cd5234b0-21f9-4541-82e3-af6b44d2a3f7
9e084253-3b72-4e1b-8013-f65c411db9ec	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	INITIAL	5	0	5	\N	Initial stock	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:36.091852+00	ce9defdc-cf4f-4d1a-95a4-a6ed8d4d5fdb
8ea256a9-4732-4649-b68c-45518d162c39	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	INITIAL	3	0	3	\N	Initial stock	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:36.106792+00	36e87102-9405-4de7-b836-eeed5483b5b7
5d8ebe16-d206-494b-bebf-d2af0c88715c	4c266dc8-d833-48bf-831f-fdf5b3e089b6	499fbc66-186d-45a2-bf27-2122e20c7947	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	INITIAL	7	0	7	\N	Stock for Gombe branch	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:38.26658+00	cd5234b0-21f9-4541-82e3-af6b44d2a3f7
1dfc1e47-d4dc-416e-b04f-47ddae602ca4	4c266dc8-d833-48bf-831f-fdf5b3e089b6	5825d4ab-210b-48dc-8e77-bd12d4195466	eb6f63a9-5671-47e5-90fe-8924d0c1b28c	ADJUSTMENT	-4	10	10	\N	Reserved for online order	3b604540-0c86-43ad-a66b-15431c4664f5	\N	2026-08-21 23:08:38.301894+00	cd5234b0-21f9-4541-82e3-af6b44d2a3f7
a8ecf4fd-7e2d-4581-bf46-aec99ac671fc	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	d2353df5-96fa-4636-a01d-d7503b30b9d3	INITIAL	20	0	20	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:18:09.535518+00	52aa22d4-ef94-4d95-921d-643517c28407
8e3a1c0c-de1b-48c5-a9d4-1ad526001448	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	INITIAL	10	0	10	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:18:09.604124+00	af48f61a-fb4a-424a-b1df-daf72792421c
79943774-13ea-47f2-8a02-26bdcd8486cd	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	INITIAL	5	0	5	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:18:09.612019+00	b149227d-9a59-4832-85ed-2f06435ef853
832b121d-97ef-401e-b18b-30fb0caf5671	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	601bb78e-e450-4a02-b6e3-6d32d2b91647	INITIAL	3	0	3	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:18:09.620134+00	6addcdb7-adbc-4d0b-96ea-1516efdd4037
5740e084-6283-4406-ae51-81efc253b135	13193bb5-b17f-4097-ba81-43005ad5c416	9239d434-08e4-44b9-ba04-5e91a1aba9eb	e6340d1c-60c7-4f28-a626-fecc0f511f71	INITIAL	12	0	12	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:18:09.642773+00	a6213ce1-3fd0-432d-963d-ea6ff404c55b
7de87e69-757f-4790-8af2-f0af08d37283	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	INITIAL	6	0	6	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:42:57.209689+00	8404132a-f171-4131-b3a7-829ad21c15ff
edb7222d-17a8-447b-9455-775d11e6789d	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	801e97f1-a26c-4e71-afbb-37ec3b2d6b22	INITIAL	4	0	4	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:42:57.224086+00	20dc2c86-3e17-4949-a3d2-152be599b766
69b56922-ddc7-4f6a-b4e0-0acaabd1954b	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	INITIAL	6	0	6	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:45:15.853652+00	a7a086ec-b66e-4452-a34e-972df4fcafa1
83bc4c07-c8c2-485d-9e70-568283b60e3e	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	f16c3a8a-6a9a-4fa9-93c8-09c13cacf249	INITIAL	4	0	4	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 00:45:15.868958+00	1c019546-3a02-4560-9027-7fab989def23
88c61608-b538-4201-8a7b-3a87ba0c4290	13193bb5-b17f-4097-ba81-43005ad5c416	9239d434-08e4-44b9-ba04-5e91a1aba9eb	d2353df5-96fa-4636-a01d-d7503b30b9d3	INITIAL	12	0	12	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:03:41.694153+00	52aa22d4-ef94-4d95-921d-643517c28407
6bfc340d-317c-4387-a2f3-f0ae2706fd45	13193bb5-b17f-4097-ba81-43005ad5c416	9239d434-08e4-44b9-ba04-5e91a1aba9eb	d2353df5-96fa-4636-a01d-d7503b30b9d3	ADJUSTMENT	-12	12	0	\N	Product removed from Shop	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:03:41.827526+00	52aa22d4-ef94-4d95-921d-643517c28407
d5c295b9-2a39-42d3-afd6-0e752b3d73c8	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	11bae456-e460-4c61-9f3d-81cf8fec8387	INITIAL	7	0	7	\N		33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:03:42.574213+00	474f23b5-d9a8-4bde-8e9d-11b7e5159236
0d4a5495-6c58-44fc-a671-75b9f995e39e	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	0597d6c0-7d34-40ad-b06e-cb917a6eff76	INITIAL	6	0	6	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:11:14.020883+00	87e34596-a510-4615-82d4-27b244c804ca
53ab379b-7970-4d61-acfd-c1fd8dc75ed0	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	0597d6c0-7d34-40ad-b06e-cb917a6eff76	INITIAL	4	0	4	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:11:14.065106+00	dd7cea02-4980-4d0e-ae08-3715b2c4f7a7
577eb39a-26c4-4c5b-b19e-0472deb35da6	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	02b5836e-dbe7-4089-b2ff-f5c2210581f2	INITIAL	0	0	0	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:19:20.076842+00	e8cb2574-2c41-42b8-83e2-6e28ce6682e4
d632afac-9324-4976-bcdb-7aa52033673b	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	02b5836e-dbe7-4089-b2ff-f5c2210581f2	STOCK_IN	0	0	0	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:22:19.567186+00	e8cb2574-2c41-42b8-83e2-6e28ce6682e4
22cd1fa7-3783-4e44-bb51-803f60724f09	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	bf84c071-3b23-476b-aaa1-e517f76f583a	INITIAL	0	0	0	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:23:12.938025+00	6966ff43-eacb-446d-9397-0a48c8d9df87
98bd2126-c1d1-43c7-8242-23610bdb5580	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	INITIAL	6	0	6	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:23:37.603788+00	54f0758d-5169-455e-84f2-5beae07199e3
4357ba7c-3922-4063-a2e0-660d35984f0d	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	9f1beba7-30c2-4f13-8f2a-0127863a7ab5	INITIAL	4	0	4	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:23:37.652542+00	fb0a5c01-2aee-4364-9e78-56d445d4993f
f544c703-fc60-427e-bc2f-20e01f83a8ed	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	51adcf0d-f636-4da2-8045-bf303f76ed0b	INITIAL	6	0	6	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:30:30.541711+00	61fcd4a0-2e23-4ed3-a803-02a212b9c409
13f99216-e567-4915-b810-5d1cd2028ff1	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	51adcf0d-f636-4da2-8045-bf303f76ed0b	INITIAL	4	0	4	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:30:30.579638+00	6d207968-a153-4214-9312-a433410c8493
ba6fcc18-046a-47f8-a4de-e79cfaea3fa6	13193bb5-b17f-4097-ba81-43005ad5c416	49c1cd3a-3407-4dbb-bf22-095648bee580	643f0184-bebd-4cd2-bdcf-23505d17b5d7	INITIAL	0	0	0	\N	Initial stock	33ee2282-5467-4c59-ac70-b4b6a020f38f	\N	2026-08-22 01:30:46.642486+00	445630d9-ab21-468f-be18-1e84dee2b63b
0147fde1-0335-4ced-aa1d-135ef05b2294	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	240989cd-66f6-45bd-ac81-62ea6ac175e4	INITIAL	0	0	0	\N	Marketplace offer registration	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-24 14:36:55.93309+00	c62fcde1-ff3b-4424-a621-5f509bae0163
a8edd0b4-1dbd-4484-bae9-85b13d53a0ea	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	ADJUSTMENT	-3	3	0	\N	Product removed from Shop	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-24 14:42:58.636084+00	bc436e11-3196-439b-8e5d-8e1a3c0a2f4a
20d2f772-8be5-4fe4-86cc-15998713edb3	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	ADJUSTMENT	-5	5	0	\N	Product removed from Shop	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-24 14:42:58.636084+00	67ac0e2d-2807-4e36-b628-5bb80171a4a0
65fd4a38-c54f-4865-86ac-1f84009bebb1	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	56fd557b-8d02-4cb4-afb9-7a46b5611838	ADJUSTMENT	-10	10	0	\N	Product removed from Shop	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-24 14:42:58.636084+00	15d87612-9934-431c-87c5-d961fc4177a8
491e05dc-6d56-4506-8ecf-28b374989f6d	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	22222222-2222-2222-2222-222222222222	ADJUSTMENT	-40	40	0	\N	Product removed from Shop	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-24 14:43:11.951075+00	22222222-2222-2222-2222-222222222223
a744ea59-a97c-486e-9e8d-8fbec04d8483	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	INITIAL	0	0	0	\N	Marketplace offer registration	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-25 08:09:30.93264+00	bc436e11-3196-439b-8e5d-8e1a3c0a2f4a
bb4a832d-bde8-436d-ab63-94bcfde072c8	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	INITIAL	0	0	0	\N	Marketplace offer registration	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-25 08:09:30.953654+00	67ac0e2d-2807-4e36-b628-5bb80171a4a0
9b40605b-5722-4f1c-9dd5-67fd234f330b	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	56fd557b-8d02-4cb4-afb9-7a46b5611838	INITIAL	0	0	0	\N	Marketplace offer registration	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-25 08:09:30.953039+00	15d87612-9934-431c-87c5-d961fc4177a8
bd87470f-c757-4151-9082-45869b0f188d	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	240989cd-66f6-45bd-ac81-62ea6ac175e4	STOCK_IN	2	0	2	\N	Restock from product detail	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-25 08:37:51.214744+00	c62fcde1-ff3b-4424-a621-5f509bae0163
dd02dcc1-5bf6-4aa4-801f-230ee74df35d	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	2dec452a-7c11-4412-97e5-ad733e3bb0ff	INITIAL	32	0	32	\N	Initial stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-25 11:53:32.309319+00	346c2ac5-3291-4360-a240-f0b198c200a0
c43462a6-9374-47d5-a9e3-c84004001169	34f536ff-c14c-4a57-a933-930518d428e2	046d278c-9140-4b89-9055-4024789f9e35	2dec452a-7c11-4412-97e5-ad733e3bb0ff	STOCK_IN	2	32	34	\N	Restock from product detail	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-26 11:21:54.348688+00	346c2ac5-3291-4360-a240-f0b198c200a0
b66b2d8a-2892-4d0c-b613-321af9fb1db4	ae3f1005-7ca3-436e-ae7f-b70abe3a6a92	422180d1-4773-441d-90db-f989ea1df09b	25bb1f32-b839-4350-ac1e-05f15bb9fadb	INITIAL	10	0	10	\N		2f4bb545-2f88-4326-a274-e12b0815656e	\N	2026-08-26 13:19:07.20876+00	0d912723-82ba-424f-825c-d89cc055eff5
04fc72ab-f648-4bfb-bf7a-fb08d607ad4f	f5bbc830-34b8-45a0-b50d-b16b0a362689	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	3633db86-a845-4652-a3a2-479204e9df3d	INITIAL	10	0	10	\N		80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	\N	2026-08-26 13:26:41.094256+00	2edd16d1-d166-4042-869c-dc69c5ab0fee
96b53843-3e66-4c5c-ad1a-cec3f1895e4e	1ba51d3e-52e7-40ec-878d-55a7d135bdad	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	1182341b-db96-45e6-8fae-ae5b86f7c5b0	INITIAL	10	0	10	\N		df9edc86-2eac-40d6-a0b4-625385b387bc	\N	2026-08-26 13:28:13.536209+00	8a34623a-177e-4ba9-8fda-e202569a2177
0954c886-5b5f-4af2-b18c-7e7f89e3d80b	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	INITIAL	0	0	0	\N	Initial stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-26 14:17:53.261601+00	d3edb42b-e3d9-4750-b851-2b2483673301
f9e3f374-032a-4cfd-9ef3-dfe26c3ab988	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	STOCK_IN	4	0	4	\N	Restock from Shop Products	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-26 14:18:21.583152+00	d3edb42b-e3d9-4750-b851-2b2483673301
07c0dc81-ef36-4226-9f16-b1fb437f9480	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	INITIAL	5	0	5	\N	Initial variant stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-26 14:19:31.310892+00	ff36085b-ac18-4b81-80d8-6d5711a251d8
e3e1cc7f-627f-45f1-9e68-dddba804d621	34f536ff-c14c-4a57-a933-930518d428e2	fc37b990-a26f-4729-bb83-fd9918712e03	9f21b16c-1b8d-4bfc-a4d0-31274095d6d3	INITIAL	3	0	3	\N	Initial variant stock	10f488ae-e546-407e-ad82-96efb18466c6	\N	2026-08-26 14:20:01.40444+00	e917c3a7-323a-4ff2-a697-47e7b29c5ba9
e8051f0b-4167-4083-a7f7-e6ef17af25f3	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	INITIAL	10	0	10	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.395287+00	d8485982-b5c1-41a8-b202-faea034099c3
b7f02232-8a14-4c88-94e0-cd042538f8fd	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	INITIAL	5	0	5	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.417179+00	777d37dd-23bc-4150-b384-9c83261d0008
5936e594-86cb-4c22-8acc-6fa7efc87083	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	INITIAL	8	0	8	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.429849+00	b1f8dbc3-0295-4332-8e7e-cf0d5f4e8e3b
03715c0d-2d95-4494-8b34-70645883c85a	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	59a5ada8-18fd-4944-8622-be244a516c29	INITIAL	3	0	3	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.445955+00	5a971890-6510-40d5-8eab-fa165506b0bd
bd8b2fdf-4fd9-4d00-b56b-005e958e39cc	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	INITIAL	10	0	10	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.63272+00	9536a714-88b2-44cc-9cd4-d6d91c17238a
a740faa5-8e0e-46c4-9607-f0293fdc1ab9	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	INITIAL	5	0	5	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.647888+00	681c287e-98ca-403a-9b97-3fd968e2b485
7e714733-7a97-4206-abd5-46004fd105cf	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	f4c3f332-2bd4-4195-9eba-8c9e4ec126eb	INITIAL	8	0	8	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.660941+00	c47d883a-c363-4056-bdd4-220797b73147
31e44e22-4549-420a-a425-f0b0a50643cc	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	INITIAL	20	0	20	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.732951+00	6f4107cb-5d3a-4a9c-a110-87d35b8b75cf
f2233e91-3f57-4794-84ef-3ed92121f6da	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	INITIAL	15	0	15	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.748681+00	c86c43ad-f134-4e88-8ca3-147750dda696
b42f4aad-29db-4614-9654-634718f31c36	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	INITIAL	10	0	10	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.763612+00	9399d553-e713-47d2-8d7c-e1e963035493
1e9d4240-7096-41a7-a8c2-67d85a85f157	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	a5480f4b-675c-4c90-9b42-8171dd25b6b1	INITIAL	12	0	12	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.779382+00	52357a84-cd46-4ade-a543-8ef7f792308a
c4cc6aa1-15ee-45e6-abcf-84a00b82aabe	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	INITIAL	5	0	5	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.851475+00	092005dc-8623-4e9e-9047-ca6e828ed017
97c6c721-8018-4570-9e56-78aa018cc76f	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	INITIAL	3	0	3	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.867582+00	25c3aae5-7236-4e17-940f-3bc55856026e
b4b0f219-d77d-412e-8238-8af0dbaea69d	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	INITIAL	4	0	4	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.882505+00	804ba596-ce23-4623-8767-b63e6e1d5336
c9ddc025-a1c5-45a6-93cf-ff3948ac3f11	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	50f14201-f49e-4211-b044-6c24f12eb48c	INITIAL	2	0	2	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.901705+00	d77217fa-d737-41df-920c-7a8349b32750
41dcc147-ac73-4133-87e1-016a88978199	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	950ad450-2f4f-4661-ba0d-d40cb7f57ae0	INITIAL	12	0	12	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:09.968002+00	41f06336-be5b-489c-a0e3-d900d556ec9b
077b69e5-27ef-4ddc-beca-51ac661b0f0f	f25f43bd-ab50-4b87-b053-40a6af262d5b	03e39c93-f443-4c5a-8958-46c0a44f42c7	038981eb-f126-4009-a431-7a53744ecc07	INITIAL	5	0	5	\N		f87c1ce5-6819-4d12-a0a9-85055d806ae5	\N	2026-08-26 15:20:10.033946+00	429e9c2a-177b-4806-b6df-919cbe3e71ed
d797c392-4781-4278-a536-d6ef1c93630a	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	INITIAL	10	0	10	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.336986+00	8c381b27-8a7e-445a-a6ea-8b425cd00952
185aaa80-09af-4c2c-856f-a09587bc3be9	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	INITIAL	5	0	5	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.354614+00	cd142b02-85b2-4368-8e3b-8f64e94214d1
d8e3ed49-2745-4e5c-b0d4-985917076bb2	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	INITIAL	8	0	8	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.370591+00	61c2f24b-3d22-4c1e-86ee-6df609e7f8fe
adf458bd-bec1-43e5-b2bf-47a40fecd5ab	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	709a4660-fd50-434c-8365-9f3c801d46a8	INITIAL	3	0	3	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.423172+00	7ceff9bf-8559-4caf-a3fc-473ff25bd585
0d93200a-9e3f-4f42-b626-cdd86d375c48	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	INITIAL	10	0	10	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.658733+00	17b9bb08-1fda-4d51-9740-7bc6020dfe83
d5feeae4-9a65-4bab-92f9-ab4d6f968013	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	INITIAL	5	0	5	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.676438+00	52644af3-8fd7-4954-8073-3e2f40d1b920
a0c73ce4-88f9-4a31-b2bd-74e55030fd4b	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	4e1e7e4d-57a8-4fbb-b52b-a8acdce3b3ea	INITIAL	8	0	8	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.695834+00	0d8957e4-b643-4413-89e9-6d99e5772d7a
b77ff4a0-b654-4fcf-8bf7-8fac9a59a04b	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	INITIAL	20	0	20	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.766432+00	4735b867-63af-498f-a4e9-03a83354c007
ca2a8d2f-8a22-4a0d-b628-5c49d80c3b22	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	INITIAL	15	0	15	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.78404+00	4b853476-365c-48de-a269-e6a739b5b827
4757e49d-9b43-4ec6-8b5f-d48b29d56d95	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	INITIAL	10	0	10	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.802507+00	8ba6ce5f-a036-4bb1-be28-0fd14be45fc1
63c760e1-ede7-446d-a77d-0e5162356a71	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	1441d588-bab7-4d95-9af7-6820a3ae4d28	INITIAL	12	0	12	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.820364+00	96130975-fcfe-49cc-9dce-97fa8b7cb543
2f68ab3b-3266-4f65-b434-3573508b3091	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	INITIAL	5	0	5	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.920239+00	7021f3c7-e63c-4025-b499-4b7ee572dd10
b4353572-e097-43d4-98ed-5698c18add5b	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	INITIAL	3	0	3	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.940044+00	9bf786be-b399-4d16-83b5-bfb922e62f0b
782ee75f-caa0-43d8-bc42-2576207ba5ca	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	INITIAL	4	0	4	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.957259+00	6f7e2460-bcc3-48b8-b929-79dda417dcd8
59ab9506-7363-41cb-81dc-912c146841e8	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	d5137c00-0349-4e09-a9e3-bfbae3bfa44e	INITIAL	2	0	2	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:26.993157+00	74138177-d61b-4931-a987-38d6053c2b5a
26b9d5be-d47b-4ab0-8163-3dcf8d4f9e75	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	3a758e49-51c7-4051-abd8-35f6d97d1137	INITIAL	12	0	12	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:27.092993+00	91c2ed6b-ad4d-47fd-b750-04b50c9ce3a8
8df7be35-3d14-4e8e-b890-92994156fe83	65a47cfd-4a86-4a1c-beab-63c72c97747c	2a57279c-cc2f-4656-9de5-6ff936e27640	a783edfa-22cc-415b-8a83-487edb568366	INITIAL	5	0	5	\N		f56c4268-e4d2-4382-8e8a-8ba603e663f7	\N	2026-08-26 15:21:27.265985+00	08f5d1ea-2a72-4de8-8476-b3d49a0cd198
ad803ec2-0149-4946-bd2a-12f1726dc651	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	INITIAL	10	0	10	\N	Initial stock	8700aec8-b351-4e33-845e-8254918e00ad	\N	2026-08-26 16:23:43.12289+00	11145bb0-ede0-4981-b683-a8def97c26ef
9df193f4-4561-4739-ae0c-27547b140d64	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	INITIAL	5	0	5	\N	Initial stock	8700aec8-b351-4e33-845e-8254918e00ad	\N	2026-08-26 16:23:43.156194+00	53c0988a-3d96-453b-9546-69f83e16a29f
3a114d67-db21-44a5-a25e-f49dc377e8a1	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	INITIAL	8	0	8	\N	Initial stock	8700aec8-b351-4e33-845e-8254918e00ad	\N	2026-08-26 16:23:43.165001+00	f292323e-9317-48e1-b4a4-26fbc3761b61
c0c69e0d-f261-4d41-a9c7-0e5fcccd60ce	28158bd6-cd39-49a8-a0a9-58ec324473bc	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	497354c6-1272-48fd-b975-587a23f204e4	INITIAL	3	0	3	\N	Initial stock	8700aec8-b351-4e33-845e-8254918e00ad	\N	2026-08-26 16:23:43.175353+00	7a0796a7-424c-433c-a652-72316a0490f8
\.


--
-- Data for Name: stock_receipt_lines; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.stock_receipt_lines (id, receipt_id, variant_id, quantity, unit_cost, notes, created_at) FROM stdin;
\.


--
-- Data for Name: stock_receipts; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.stock_receipts (id, business_id, shop_id, received_by, reference_number, notes, status, received_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subcategories; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.subcategories (id, category_id, name, slug, status, sort_order, created_at, updated_at) FROM stdin;
b1c4e813-b6c3-41b8-991f-d13fad541b35	34ee875b-0c79-4eef-897d-dac1cd07cad1	Shoes	shoes	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
ffc6c47c-9d4e-4908-9f26-23d7f239bf3a	34ee875b-0c79-4eef-897d-dac1cd07cad1	Clothing	clothing	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
09b423fd-8c13-46c1-ad25-80939d211353	34ee875b-0c79-4eef-897d-dac1cd07cad1	Bags	bags	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
35bbddc6-3453-4d4e-b9ee-36af58fbc779	34ee875b-0c79-4eef-897d-dac1cd07cad1	Accessories	accessories	ACTIVE	4	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
941f2664-f1e1-4d91-9072-d3aeb1a16d04	342aa21d-5919-4139-a189-3461ccc96c48	Phones	phones	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
773030c0-8b58-4a7f-869c-7a1db6afe354	342aa21d-5919-4139-a189-3461ccc96c48	Computers	computers	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
115e1f82-1fd1-4c21-af88-e0d98589914b	342aa21d-5919-4139-a189-3461ccc96c48	TVs	tvs	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
f5eeaf02-75ba-4a9d-a5b3-67a8a9b12d9a	342aa21d-5919-4139-a189-3461ccc96c48	Accessories	accessories	ACTIVE	4	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
6909481c-f5fa-4862-9264-4f7b873543c1	1c78e8b4-9665-4faa-b158-3ff6fe77f517	Furniture	furniture	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
8c2e9f60-9128-4cbb-b202-4410f4c3b5fe	1c78e8b4-9665-4faa-b158-3ff6fe77f517	Kitchen	kitchen	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
b8b02330-d71d-4413-8b53-f3f8e334ab09	1c78e8b4-9665-4faa-b158-3ff6fe77f517	Decoration	decoration	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
e642cd51-4186-42c7-9d0e-0211b47f2b90	e2492a82-8005-467f-af8e-e352caf26067	Clothing	clothing	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
5cfb14fb-7713-4352-bf9e-7dd09a03016f	e2492a82-8005-467f-af8e-e352caf26067	Toys	toys	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
ecb2f971-5279-41cc-8970-cdec2b599e25	e2492a82-8005-467f-af8e-e352caf26067	School	school	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
91473f04-b887-4b03-94da-7472541982a8	e2492a82-8005-467f-af8e-e352caf26067	Baby Products	baby-products	ACTIVE	4	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
0ebb892f-2a6f-4847-85ae-617bc52eeb2c	a77da559-9b31-4b96-a01b-08c7c585630d	Fitness	fitness	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
0cad8c90-4a99-483a-8a2e-e6b2b218460a	a77da559-9b31-4b96-a01b-08c7c585630d	Outdoor	outdoor	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
b8fd1c7b-899f-43cb-9c80-c85cb0930b43	a77da559-9b31-4b96-a01b-08c7c585630d	Team Sports	team-sports	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
13a9f6ca-0e02-4106-a34b-0f0674b56e9b	2452f078-5c79-4dde-a7d4-1e9afab17bc9	Skincare	skincare	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
19a4b05d-8cef-4d82-bb1e-27524662145f	2452f078-5c79-4dde-a7d4-1e9afab17bc9	Makeup	makeup	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
cb0adb36-7c07-4cbf-a6cc-691f7ff6b815	2452f078-5c79-4dde-a7d4-1e9afab17bc9	Haircare	haircare	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
2c981f12-e64b-491a-b2db-7a9a4bf7d310	1b94f540-a42b-4833-be2e-33ff44454be0	Beverages	beverages	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
48e58d6f-fe03-44a5-973e-ab03594dabd7	1b94f540-a42b-4833-be2e-33ff44454be0	Snacks	snacks	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
faf0cd5f-5e2c-4b2c-8c29-b226fbaa732d	1b94f540-a42b-4833-be2e-33ff44454be0	Bakery	bakery	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
68671ccd-004b-400b-b6a4-8383f0b6d3bc	7d4a48d7-9517-4986-a081-838b97c9b21c	Parts	parts	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
5ce43abb-ec63-4a78-a925-9080c52e5cfe	7d4a48d7-9517-4986-a081-838b97c9b21c	Tires	tires	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
bab9cb89-6864-4196-8bfa-00795ee82266	7d4a48d7-9517-4986-a081-838b97c9b21c	Accessories	accessories	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
a6f40832-bc5f-40dd-b6e2-c83c49f653c0	c09b3b4a-cfe3-4e3d-826a-f7d45fa61f14	Repair	repair	ACTIVE	1	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
e27e886a-b5d7-421a-b287-9474634fa1b2	c09b3b4a-cfe3-4e3d-826a-f7d45fa61f14	Consulting	consulting	ACTIVE	2	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
9f0ac094-1b92-4dc8-876f-ba5d9a9e5ca3	c09b3b4a-cfe3-4e3d-826a-f7d45fa61f14	Delivery	delivery	ACTIVE	3	2026-08-16 17:50:16.282686+00	2026-08-16 17:50:16.282686+00
66666666-6666-6666-6666-666666666666	55555555-5555-5555-5555-555555555555	Running	running	ACTIVE	1	2026-08-18 14:22:15.110521+00	2026-08-18 14:22:15.110521+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.users (id, first_name, middle_name, last_name, phone, email, password_hash, status, email_verified, created_at, updated_at, account_type) FROM stdin;
e271741f-799d-49b0-ac63-8e382d67fc6c	Seller		Orders	+243819452386	seller_ordertest_20260821125423@example.com	$2a$10$N7MX/RKgRblVKIUsTe07kuf1XqsDhZdDIez8R3rz.7.DuPa/NiDqe	ACTIVE	t	2026-08-21 11:54:24.337096+00	2026-08-21 11:54:24.337096+00	SELLER
00c2d92b-4a5a-4000-b15b-a888d217f4c9	Web	E2E	Test	+24390055600	seller_web_051556@test.com	$2a$10$/.ARVSaAtHcJ/LgOM8plJ.I2u0oTmmQzU0NHT5WiLPEqCP5BG8kdq	ACTIVE	t	2026-08-21 04:15:57.187765+00	2026-08-21 04:15:59.924477+00	SELLER
ddabcdf3-c71d-4b0a-8493-96ee7f68bdc9	Emp		One	+24383355601	emp_web_051556@test.com	$2a$10$lQAvOQUYOIGundyo5GVKj..Rfuf.pejqOX7H0KMlaAtX0kEPSeiY2	ACTIVE	t	2026-08-21 04:16:11.589363+00	2026-08-21 04:16:11.589363+00	EMPLOYEE
a64886eb-19bc-49fd-9fc6-d2090eec44ed	Owner		B	+24394455600	ownerb_051556@test.com	$2a$10$B5xaBUem/5vt6.kB3FFDgucVR2Cvc55T.7Kkps/K2ZCLi1HH4UFtC	ACTIVE	t	2026-08-21 04:16:12.796559+00	2026-08-21 04:16:13.06348+00	SELLER
0569f950-4bfd-4f1d-9354-2ad7672e6dc3	Buyer		T	+24397755600	buyer_web_051556@test.com	$2a$10$VQ7Wf7YJ7HK4TM71kmkwie8VMCU2B/3t.hsm06a95hsDbzwB1AWaa	ACTIVE	t	2026-08-21 04:16:13.438329+00	2026-08-21 04:16:13.820418+00	BUYER
dfd1d4a5-c175-4348-9601-8a4d27802d63	Web	E2E	Test	+24390073100	seller_web_111731@test.com	$2a$10$ELoSfSaWTAgz.abRm7ukAeOhTmz715hFFB0Xvax/ILe32S2dsQNdm	PENDING_VERIFICATION	f	2026-08-21 10:17:32.125258+00	2026-08-21 10:17:32.125258+00	SELLER
42861d49-0faa-4c2f-9af0-c2705d5ac72f	Owner		B	+24394473100	ownerb_111731@test.com	$2a$10$dYu4Hj8iVti9.sv.vdrKS.qogqdeAS7phP5T2MLk4Q9qnecDCN1CK	PENDING_VERIFICATION	f	2026-08-21 10:17:49.408801+00	2026-08-21 10:17:49.408801+00	SELLER
ca16f4d1-e5f7-418a-8aed-426facadd4ef	Buyer		T	+24397773100	buyer_web_111731@test.com	$2a$10$jsQ2rKalhBcI5DNMA5roIeb4qj9EZPH1qwtmNq.c7Hrd8C1kGvnm6	PENDING_VERIFICATION	f	2026-08-21 10:17:54.656695+00	2026-08-21 10:17:54.656695+00	BUYER
d6c335ec-c9ab-412e-b8b8-ccaa707d6459	SellerFirst		SellerLast	+243810328657	test_seller_20260821122155@example.com	$2a$10$oWHT9Dkq6RbNlBf1MiWQrO.IYxHIo/jXeMyyP.wOFoo697cJlmO2C	ACTIVE	t	2026-08-21 11:21:56.227743+00	2026-08-21 11:21:56.227743+00	SELLER
f827bb2d-a0de-44d5-bc8b-2420eb649399	BuyerFirst		BuyerLast	+243811724466	test_buyer_20260821122155@example.com	$2a$10$HvDnh.Y6zN4VGMB17f6mn.q63KA2wvVWHiyFd05Bhi3Eo/nh.ZIWW	ACTIVE	t	2026-08-21 11:22:01.860765+00	2026-08-21 11:22:01.860765+00	BUYER
161b2af3-20d7-48f9-8a93-f1955402178c	Owner		Seller	+243812271937	test_owner_20260821122237@example.com	$2a$10$mRy0XW2MTmrW9UMFyXDYKO45CZRjRIpBk6uDlsvCX5p/52M0xx9Lm	ACTIVE	t	2026-08-21 11:22:37.8667+00	2026-08-21 11:22:37.8667+00	SELLER
54721785-d2ea-42a3-9b02-c89c13f72777	Buyer		Tester	+243818458828	buyer_ordertest_20260821125423@example.com	$2a$10$jGH5u0d2u/3By6Rq.TKQyeCXOuA6NJ61KZg6DP5cM4Bx9k/1GlsB2	ACTIVE	t	2026-08-21 11:54:28.760022+00	2026-08-21 11:54:28.760022+00	BUYER
1b928f7c-b6a7-4068-a392-d4f3f51fc93b	Owner		Seller	+243812597566	test_owner_20260821122332@example.com	$2a$10$IhfRz4gIQVZ6kjCEZV6MU.CEmsDPhJxtfz2ssZmc.woE2NIXT0vWG	ACTIVE	t	2026-08-21 11:23:32.87476+00	2026-08-21 11:23:32.87476+00	SELLER
76d852b2-31fd-42a0-a775-499b1e547358	Owner		Seller	+243812420341	test_owner_20260821122429@example.com	$2a$10$hHH51UWsBeSKlZrdQhPWAeAzEcUg7vuZ3EzR2U6mNKilxX2Iwyvza	ACTIVE	t	2026-08-21 11:24:29.760314+00	2026-08-21 11:24:29.760314+00	SELLER
a0de438d-d002-40e3-bbf8-4f6db93d2806	Seller		Tester	+243819822494	seller_fulltest_20260821125121@example.com	$2a$10$FLOrwGOjIDTHiiC37w76qOswFOW4emDqlJDra6aTMe4J2r8Cs8WjG	ACTIVE	t	2026-08-21 11:51:22.743553+00	2026-08-21 11:51:22.743553+00	SELLER
deff6045-e0b5-4005-8333-9c22e88edc61	Seller		Tester	+243819938032	seller_fulltest_20260821125341@example.com	$2a$10$fyEv5RaiOPpLcrzTk16Z1er1GNvdvN7tVF/mFay48tS60LRzAldPO	ACTIVE	t	2026-08-21 11:53:42.326172+00	2026-08-21 11:53:42.326172+00	SELLER
dec18fe0-92d5-4faf-98db-9c5d615fdace	Seller		Orders	+243819313935	seller_ordertest_20260821150246@example.com	$2a$10$FToinK/hUOtRTgxc00mBaOEWkajX7JkbgZYLrfr3x2xQLPsUeqDce	ACTIVE	t	2026-08-21 14:02:46.84813+00	2026-08-21 14:02:46.84813+00	SELLER
fe4af24e-8a53-4d72-a56c-5bb51b5937bc	Buyer		Tester	+243818730838	buyer_ordertest_20260821150246@example.com	$2a$10$wJEKCbydffpdaVAxNuAi5OWt0F45gNz0gFjoaKLt6BJ9ULlkz3HKi	ACTIVE	t	2026-08-21 14:02:57.789122+00	2026-08-21 14:02:57.789122+00	BUYER
90cbc7de-c7c3-4043-8ee3-7b348ee99aa6	Seller		Orders	+243819697954	seller_ordertest_20260821151259@example.com	$2a$10$Zx4Vsn6bYILsbGSKq2Q45OEobXKmM3pSpe4fzmBQ5ZGwKllKaHCW.	ACTIVE	t	2026-08-21 14:12:59.507579+00	2026-08-21 14:12:59.507579+00	SELLER
79684130-93c3-44c7-a9c9-b3c313449da5	Buyer		Tester	+243818124061	buyer_ordertest_20260821151259@example.com	$2a$10$ndrMl0gQAJ7sGy.A12mmaeI5N24jfswFOYa7rIq5m4FIOiFkVj9bi	ACTIVE	t	2026-08-21 14:13:07.242939+00	2026-08-21 14:13:07.242939+00	BUYER
d31867cb-cc3e-49c6-ba4c-04d10901255b	Seller		Orders	+243819882763	seller_ordertest_20260821151348@example.com	$2a$10$HmozEZkX4.kNkuvzfyTjs.Hh/9N/UcoHsfqPtrq4pPodV0JPlXg9y	ACTIVE	t	2026-08-21 14:13:48.904928+00	2026-08-21 14:13:48.904928+00	SELLER
fea3d9d4-bb12-4a43-8d31-347af8c4e20d	Buyer		Tester	+243818329182	buyer_ordertest_20260821151348@example.com	$2a$10$5heLDuY9ZpIEHuJpPcnOAecKOkc1mWn/hELBnIJ.XQ08QHegIe58C	ACTIVE	t	2026-08-21 14:13:54.756917+00	2026-08-21 14:13:54.756917+00	BUYER
e4b19e15-2db5-4c16-82a8-5961cbe69a10	Stock	E2E	Tester	+243991_2345220	seller_stock_20260821_234522@test.com	$2a$10$k3JnPmDHcWW0rZDRddn31ebW5weAbPiMKQpEuj1Das8A2VGhRhrDO	ACTIVE	t	2026-08-21 22:45:23.1939+00	2026-08-21 22:45:23.1939+00	SELLER
278ad0a5-5139-4fd6-86b0-45014f28d6a7	Stock	E2E	Tester	+243991_2346310	seller_stock_20260821_234631@test.com	$2a$10$ymEd2oKdiZXD/VsDbNzOJezZ9aAskUx6FgRSrUmupE3WMy2fFzWPi	ACTIVE	t	2026-08-21 22:46:31.718757+00	2026-08-21 22:46:31.718757+00	SELLER
88405f91-3489-4d58-b613-296bef30e2ef	Stock	E2E	Tester	+243991_2347340	seller_stock_20260821_234734@test.com	$2a$10$iyifBcB3jsFwdYQfDdg4ruNBbI72xHE9C.tXbfMUUipkbKkbEKW4a	ACTIVE	t	2026-08-21 22:47:34.787727+00	2026-08-21 22:47:34.787727+00	SELLER
4afcb35b-ebb0-492c-bc26-f4961e0c43da	Stock	E2E	Tester	+243992_0002130	seller_stock_20260822_000213@test.com	$2a$10$sSDo7.DkTcOM0WmuxTXYkOYuFMLe4XKEfkmbWaQUWORvvnIcWRLq6	ACTIVE	t	2026-08-21 23:02:13.997896+00	2026-08-21 23:02:13.997896+00	SELLER
3b604540-0c86-43ad-a66b-15431c4664f5	Stock	E2E	Tester	+243992_0008260	seller_stock_20260822_000826@test.com	$2a$10$w2O3KwnMG.xtbW2Nl6bJleGeANvZrlP0w55r3ctVxn3dZI5o0skjO	ACTIVE	t	2026-08-21 23:08:26.519283+00	2026-08-21 23:08:26.519283+00	SELLER
ba65bf54-08eb-4e24-92b3-2e15df894059	Stranger		Test	+24397777020630	stranger_020630@test.com	$2a$10$nPwRCYSYDnhE3eTxaEyOeeQFlUMnKiSwAnsq8d0cSwZsPcNnmFy8O	ACTIVE	t	2026-08-22 01:06:30.895829+00	2026-08-22 01:06:30.895829+00	SELLER
ae2e7050-4bc6-407b-b670-98d82a215b9b	impoke		johnson	9157905812	johnsonimpoke@gmail.com	$2a$10$.0bKCYVx4//oB7rphBN9d.Tp61QSa2QqbMDcT4UvZK1oZvvXM84JK	ACTIVE	t	2026-08-24 14:58:58.127087+00	2026-08-24 14:59:23.798262+00	BUYER
cc99b54c-7686-4a74-9316-4da128b544d7	Signup		Regression	+243810825092447	signup_profile_0825092447@test.com	$2a$10$Ghio4NjwwCemOiVBzlvCIeFJM8SDL8K2htnODEhk1HprwnQ4SpFeO	PENDING_VERIFICATION	f	2026-08-25 08:24:47.81271+00	2026-08-25 08:24:47.81271+00	BUYER
2b453813-5644-4fde-b134-d2bc067987a9	Test		User	+243900	test_login_50325@test.com	$2a$10$tN6JhHRCexgujJ1JQU587e6Jh/VBD1UaOf8yOelXI8IRBUbxLPqLi	ACTIVE	t	2026-08-21 03:04:00.212159+00	2026-08-26 10:33:43.647976+00	BUYER
07f2e0b3-6709-4cf0-afcc-6b24db94ce93	Sync	E2E	Seller	+24390071801	sync_seller_141718@test.com	$2a$10$BWaOIecyDYyZlUwc8P7NBulG0oNYwGGN7inharYx5ntOcigF12Ji2	ACTIVE	t	2026-08-26 13:17:18.44812+00	2026-08-26 13:17:18.44812+00	SELLER
54998434-5ff1-413a-91fd-c928cfbae493	Sync		Buyer	+24390071802	sync_buyer_141718@test.com	$2a$10$js1V6sIIHJGHHAuIOw0QhuND4hO.azuG0xUduMIanwfmOPLsvIV..	ACTIVE	t	2026-08-26 13:17:25.066931+00	2026-08-26 13:17:25.066931+00	BUYER
2f4bb545-2f88-4326-a274-e12b0815656e	Sync	E2E	Seller	+24390085601	sync_seller_141856@test.com	$2a$10$N18vDZQW9ZogLlf0a5.cP.MBseqsfoZvpZUWTNWWmTw6JKPJcFSiq	ACTIVE	t	2026-08-26 13:18:56.944533+00	2026-08-26 13:18:56.944533+00	SELLER
d440befb-c451-4c38-95f1-ba5c057ca0d9	Sync		Buyer	+24390085602	sync_buyer_141856@test.com	$2a$10$JM6NILCNhNpV3ekZQphC2.czg.6uqrDmDTxQd5DALJMQulSwoBPxe	ACTIVE	t	2026-08-26 13:19:02.326955+00	2026-08-26 13:19:02.326955+00	BUYER
f87c1ce5-6819-4d12-a0a9-85055d806ae5	Prod	E2E	Seller	+24390000211	prod_seller_162002@test.com	$2a$10$CeB7qO6l8ABz6nic7cisrOa/tv4Rb9lui5bi1HR1OJPOuOZKeh7A.	ACTIVE	t	2026-08-26 15:20:02.534393+00	2026-08-26 15:20:02.534393+00	SELLER
f56c4268-e4d2-4382-8e8a-8ba603e663f7	Prod	E2E	Seller	+24390011911	prod_seller_162119@test.com	$2a$10$9xEwJ8TK06s4bQh/3S.8b.t1UfQN/k5R3UZ3ifNu71gyok6O7jqJ6	ACTIVE	t	2026-08-26 15:21:19.306871+00	2026-08-26 15:21:19.306871+00	SELLER
1bb14759-9967-4d6c-8a65-91e91731f726	Android		Buyer	+2439193304	android_buyer_193304@test.com	$2a$10$C1ZyPXkQxb0DbQUDOmYcZeOwFBUwSz4bbKO.XbSvuOyy.fFhF3hyC	ACTIVE	t	2026-08-26 18:33:04.335122+00	2026-08-26 18:33:04.335122+00	BUYER
4ad3d1d8-8224-48e3-a15f-efd114544a97	Web	E2E	Test	+24390033700	seller_web_045337@test.com	$2a$10$M9yWK3VtIpt5WPu2jI2WkOdpSkTyx7EqfJfQ9giUhW.vlT1LkqVUi	ACTIVE	t	2026-08-21 03:53:38.830247+00	2026-08-21 03:53:41.053855+00	SELLER
1a71c2be-c812-4d18-8291-e8cc3b43e017	Emp		One	+24383333701	emp_web_045337@test.com	$2a$10$Pk/WS2BQ6JwrWtDkxaQ8n.vVGNOn.DrSueeXFl2ocClSbCKhQqAgq	ACTIVE	t	2026-08-21 03:53:52.359478+00	2026-08-21 03:53:52.359478+00	EMPLOYEE
6ef27787-11f2-4de0-960f-c5d9308d0e28	Owner		B	+24394433700	ownerb_045337@test.com	$2a$10$DeM1Ul03rOvcAxOz8U.81.axwH1tHy8tHOS6lEj6jFHniJZLNqWzK	ACTIVE	t	2026-08-21 03:53:53.75272+00	2026-08-21 03:53:54.175695+00	SELLER
9fbf0cc2-ae16-45fb-a3e0-7fc1db4b4bc7	Buyer		T	+24397733700	buyer_web_045337@test.com	$2a$10$pqakE3xidvsR1Un69bvSFuPPBnWeHTt2FkBOmaQPnn3KFlN7LoZsC	ACTIVE	t	2026-08-21 03:53:54.65402+00	2026-08-21 03:53:55.132128+00	BUYER
96bee62f-1d2c-4714-86d4-20f96a6cc661	UI	UX	Verification	+243805274207	seller_ui_05274207@test.com	$2a$10$qXlhSHAnq/7EmToNCE9xv.FyRpybrwJ7Js4Ine4VGuPSyk4TdRFIa	ACTIVE	t	2026-08-21 04:27:42.698996+00	2026-08-21 04:27:44.015788+00	SELLER
9fefe244-252b-43b2-a452-d6621b6a0546	gauthier		bofi	+243989805617	bofibendedji@gmail.com	$2a$10$tLYnVOhKk0JLvx9Lr64UP.J9kH1We5rOM7GHN3keNWcITa88HMkTW	PENDING_VERIFICATION	f	2026-08-21 09:45:20.057324+00	2026-08-21 09:45:20.057324+00	SELLER
10f488ae-e546-407e-ad82-96efb18466c6	gauthier		bofi	+243989805612	bofigauthier3@gmail.com	$2a$10$fNJNxJ9boE4JkHfraBggKO8eufRwzl5s9xQiI8rJBaxvgunuPYl3u	ACTIVE	t	2026-08-21 10:35:18.04409+00	2026-08-21 10:36:22.259552+00	SELLER
88810add-fec9-4976-88bb-733ba17081c9	SellerMatrix		User	+243815714717	test_matrix_seller_20260821123318@example.com	$2a$10$iLiVru57VaJkWyH58L8KpumFHLE6rzBz6NbcNzLYoBwPR6UxqhH.a	ACTIVE	t	2026-08-21 11:33:18.806767+00	2026-08-21 11:33:18.806767+00	SELLER
0dd0cece-b905-49f5-a3e5-15a72cc42d19	BuyerMatrix		User	+243816232903	test_matrix_buyer_20260821123318@example.com	$2a$10$vfeIsKqW.OEA1rGJq.OvF.1EMCP18dNmh9Qb4Ffr.wOwvg0kWRgEy	ACTIVE	t	2026-08-21 11:33:24.125636+00	2026-08-21 11:33:24.125636+00	BUYER
d7f02ea1-97ab-443a-b162-4ff931ca2a25	EmpMatrix		User	+243817940147	test_matrix_emp_20260821123318@example.com	$2a$10$z1OPRQIHyswcqV3rAE6Vc.k9Rg5alpTvdij11mUWevPz07UCdgyPu	ACTIVE	t	2026-08-21 11:33:33.249909+00	2026-08-21 11:33:33.249909+00	EMPLOYEE
dae3304d-d7b9-46e0-adb4-0f7b023a9500	Seller		Orders	+243819359250	seller_ordertest_20260821150913@example.com	$2a$10$X9HZpM17FV.A1kKHpDO01uTTu6a1XoE5Jnjxz3YVb9VyEQHKLh4g6	ACTIVE	t	2026-08-21 14:09:13.917391+00	2026-08-21 14:09:13.917391+00	SELLER
53eabe9b-cf41-4444-a608-b08e85779c01	Seller		Orders	+243819176734	seller_ordertest_20260821152845@example.com	$2a$10$s14i1FfCO75AVc67Fi.3uOKZkpVtm9PIaczwDxj7Q9qzgsz5hr/Gy	ACTIVE	t	2026-08-21 14:28:45.952634+00	2026-08-21 14:28:45.952634+00	SELLER
2f7f19dc-5d38-4642-a3d8-4c1ed2e11d8c	Buyer		Tester	+243818497695	buyer_ordertest_20260821150913@example.com	$2a$10$Hzzxenp04ILYsXADk9mQb.aJIZC2yh4HITJzPc7GmbkylFxT6JMt6	ACTIVE	t	2026-08-21 14:09:19.878338+00	2026-08-21 14:09:19.878338+00	BUYER
c18774e1-d8f5-40f5-8582-f2b9b55912e7	Seller		Orders	+243819748882	seller_ordertest_20260821151022@example.com	$2a$10$1RUH/We5L96CsF/2NxBhmOfgJ1uF6YLy4CdRHICbnmbvzSvtBKyBK	ACTIVE	t	2026-08-21 14:10:22.897803+00	2026-08-21 14:10:22.897803+00	SELLER
ad91281f-138a-411c-ada1-8d11f4625237	Buyer		Tester	+243818702107	buyer_ordertest_20260821151022@example.com	$2a$10$IIRQD0xR7NO7A/Ht6YtavOP8DK18fjt165iHAcUhYtxaUKmM73IoW	ACTIVE	t	2026-08-21 14:10:27.98282+00	2026-08-21 14:10:27.98282+00	BUYER
ac0622f2-f999-4bad-8a3c-fb8b97304ff3	Seller		Orders	+243819395420	seller_ordertest_20260821152742@example.com	$2a$10$EIyF1rVdbxPPEhXGVwVTcuhH/YLJPQ4365g6cQKwLIh5Y21mFb3NG	ACTIVE	t	2026-08-21 14:27:42.587817+00	2026-08-21 14:27:42.587817+00	SELLER
2eeaca0b-ca2c-4c5d-8a40-7781627b2bf2	Buyer		Tester	+243818889391	buyer_ordertest_20260821152742@example.com	$2a$10$GY6V4cJHmqps7dmeu5NUsOBF2h8krlv9sHRqXVaFz1d3Ol/tCBOMS	ACTIVE	t	2026-08-21 14:27:48.598227+00	2026-08-21 14:27:48.598227+00	BUYER
8dce0e1e-2356-4798-be5d-0c2224a69939	Buyer		Tester	+243818531150	buyer_ordertest_20260821152845@example.com	$2a$10$x26bQCDaK0JnU1SdDQlfTOV23ijhYvAFBWxDLtZvVYM38BIgPTZhu	ACTIVE	t	2026-08-21 14:28:52.692182+00	2026-08-21 14:28:52.692182+00	BUYER
6912915d-4dd3-41dd-9c46-6a0efc2afa46	Stock	E2E	Tester	+243991_2359540	seller_stock_20260821_235954@test.com	$2a$10$TOVMYL6wKE38dfYrQ3pU4.znbdVuGnY9/5G1BMn3DV3SQGkj5N5dG	ACTIVE	t	2026-08-21 22:59:55.135426+00	2026-08-21 22:59:55.135426+00	SELLER
6b7cadef-8ebe-4d0d-b219-39e7614245ff	Stock	E2E	Tester	+243992_0006160	seller_stock_20260822_000616@test.com	$2a$10$WsN6sYmv1mxny.MawIZpaO3ya2./iQZCt6T91sSDvfxlEwMRCtLGa	ACTIVE	t	2026-08-21 23:06:17.187419+00	2026-08-21 23:06:17.187419+00	SELLER
33ee2282-5467-4c59-ac70-b4b6a020f38f	Flow		Test	+2439	shopflow_20260822011535@test.com	$2a$10$kqsu5076DOpRoj6HbX2xN.pbGNAIoGnHObItKNYlAx2RZV8JPw7Im	ACTIVE	t	2026-08-22 00:15:35.702013+00	2026-08-22 00:15:35.702013+00	SELLER
917cf438-53bd-4522-965d-71a60c34b814	Stranger		Two	+24396666020710	stranger2_020710@test.com	$2a$10$BXUcbB97/lYydwceuFNc/OnrBpUQHse6xheURFJDtX2VNZfg/zSyG	ACTIVE	t	2026-08-22 01:07:11.046614+00	2026-08-22 01:07:11.046614+00	SELLER
d192ad05-0c89-4e1c-bf1b-3216ef75e2a0	Web	E2E	Test	+24390090400	seller_web_085904@test.com	$2a$10$dlQMIMXQ/j8GhGYnuffGJuPTQ/Ka3gtnr1lf7DySUULaxCzcwD3By	PENDING_VERIFICATION	f	2026-08-25 07:59:04.944644+00	2026-08-25 07:59:04.944644+00	SELLER
61cf8876-bd88-4ba4-9257-573fe6d9ca3d	Owner		B	+24394490400	ownerb_085904@test.com	$2a$10$1n5Cmrop5HG5jEK8CfUFO.UZdEWTMsl0k3AxA0NpwUwqZ33.W1i06	PENDING_VERIFICATION	f	2026-08-25 07:59:22.58306+00	2026-08-25 07:59:22.58306+00	SELLER
8df33969-22f4-41ee-ada8-af1843e7d3e7	Buyer		T	+24397790400	buyer_web_085904@test.com	$2a$10$4W6wCtobKbHYYloa/XdtWuZoEKaGarrVExlybbqkxPxbYHiG7T60a	PENDING_VERIFICATION	f	2026-08-25 07:59:26.356267+00	2026-08-25 07:59:26.356267+00	BUYER
80f5449b-5d62-48fe-bf3e-c85e2b5bbe18	Sync	E2E	Seller	+24390062901	sync_seller_142629@test.com	$2a$10$zOYjFqYC1aLCfOjeqE9LVerWkehcQK.l9Losg4JJSJIQOxsJkll96	ACTIVE	t	2026-08-26 13:26:29.833139+00	2026-08-26 13:26:29.833139+00	SELLER
5593d59e-3cc5-4da3-955d-80f2cbbca1fd	Sync		Buyer	+24390062902	sync_buyer_142629@test.com	$2a$10$Vf5v3zr1RGTJEKZL3A0TA.6NrifpObXF2YojzCKwdc0L1e68xJXRm	ACTIVE	t	2026-08-26 13:26:35.814581+00	2026-08-26 13:26:35.814581+00	BUYER
df9edc86-2eac-40d6-a0b4-625385b387bc	Sync	E2E	Seller	+24390080201	sync_seller_142802@test.com	$2a$10$a5hOItIHMGYz1MEZmxMGK.LFTUj0DoJeOwhxp6f6uy6LkoHh02UEG	ACTIVE	t	2026-08-26 13:28:02.359198+00	2026-08-26 13:28:02.359198+00	SELLER
5384da9a-5b5b-4df0-9063-7cbb8cd163ff	Sync		Buyer	+24390080202	sync_buyer_142802@test.com	$2a$10$6MOwaZP5qhLJcjaY5redT.IOlrjE/7rv6krSQbntF5o85JVWgKRbW	ACTIVE	t	2026-08-26 13:28:08.145861+00	2026-08-26 13:28:08.145861+00	BUYER
8700aec8-b351-4e33-845e-8254918e00ad	Test		Seller	+243900000112	verify_seller_0826b@test.com	$2a$10$jZTcwFgxCys3Sg/oJW6twebsYvuDK15SE8BtxjPcDVam5CTJThG9y	ACTIVE	t	2026-08-26 15:53:53.095372+00	2026-08-26 15:53:53.095372+00	SELLER
\.


--
-- Data for Name: verified_transactions; Type: TABLE DATA; Schema: public; Owner: btmi_user
--

COPY public.verified_transactions (id, order_id, business_id, buyer_profile_id, shop_id, amount, currency, status, verified_at, refunded_at, points_awarded_seller, points_awarded_buyer, created_at, updated_at) FROM stdin;
34edf431-1bbd-49fb-bcaf-839b45da3d7a	89b0f950-c5fe-4059-b23d-987a88eeddaa	91eb7ec0-476f-41f3-9845-af89f864f129	4364cacd-338e-4bcf-ae7d-b8f21a857fb9	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	15000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-21 03:53:56.040185	2026-08-21 03:53:56.040185
c478cdc3-db5f-4014-8e38-be71ef679eed	8ec221fe-1463-45a3-82a7-9c8bd645326b	60555b41-17c0-4214-8109-9c456e54c8ee	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	1de90a97-8fe4-4b43-abbc-19dddc868239	15000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-21 04:16:14.780326	2026-08-21 04:16:14.780326
7cea3dbd-a56c-4375-958e-1220ac3d86e1	0bd192ee-550f-477c-bdd5-ba890b037d48	60555b41-17c0-4214-8109-9c456e54c8ee	cfa4847c-bc06-4f1a-8791-c96d71b61579	1de90a97-8fe4-4b43-abbc-19dddc868239	15000.00	USD	VERIFIED	2026-08-25 07:32:57.659735	\N	t	t	2026-08-25 07:32:57.648733	2026-08-25 07:32:57.734627
b2128ac1-5382-4d8e-a3db-c349452ce4a4	39f14eb2-a16b-44fe-a546-2701fee2b128	91eb7ec0-476f-41f3-9845-af89f864f129	cfa4847c-bc06-4f1a-8791-c96d71b61579	3e481b8f-a664-4a3f-a77e-e684dde6b2bd	15000.00	USD	VERIFIED	2026-08-25 07:33:04.08596	\N	t	t	2026-08-25 07:33:04.082622	2026-08-25 07:33:04.109644
e1401254-355b-4928-9eb2-8816b021e7b3	e916a98d-8162-47e1-9193-e08db1f3ac47	60555b41-17c0-4214-8109-9c456e54c8ee	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	1de90a97-8fe4-4b43-abbc-19dddc868239	17000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-25 08:01:25.586273	2026-08-25 08:01:25.586273
2ed1a5df-d21c-4ab8-9ba1-2211c015bce4	ccce5e9d-bc59-4dc9-b7e1-d90b4e1c3bb5	60555b41-17c0-4214-8109-9c456e54c8ee	922c74c1-1b5c-49f0-a32d-17a8c1e5bb7a	1de90a97-8fe4-4b43-abbc-19dddc868239	15000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-25 08:01:47.268988	2026-08-25 08:01:47.268988
95c43e64-9a23-4a89-bfae-efdd8501473a	9bfe4f32-bac3-4835-8db3-5b469e7d643c	34f536ff-c14c-4a57-a933-930518d428e2	cfa4847c-bc06-4f1a-8791-c96d71b61579	fc37b990-a26f-4729-bb83-fd9918712e03	12600.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 11:06:38.851572	2026-08-26 11:06:38.851572
2bb60764-f450-4a21-89b1-a3c292b1d599	ba31f915-0007-4151-9b8b-685c5f7d345f	f5bbc830-34b8-45a0-b50d-b16b0a362689	fef7e933-b5da-4e4e-bd37-32157e61a0a0	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	50000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 13:26:42.455493	2026-08-26 13:26:42.455493
34aea403-c2e4-4818-aabe-4ef833969170	77f12fc6-8628-451a-aec5-594095c83891	f5bbc830-34b8-45a0-b50d-b16b0a362689	fef7e933-b5da-4e4e-bd37-32157e61a0a0	c6a75c4e-e64a-4e92-a20e-1ad897d25fbd	52000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 13:26:45.224789	2026-08-26 13:26:45.224789
598c150d-1f9a-40cc-b2f4-fbc8bec32c26	a19c87d9-5132-4ea1-909c-e15d3f5ec4b8	1ba51d3e-52e7-40ec-878d-55a7d135bdad	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	50000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 13:28:15.29301	2026-08-26 13:28:15.29301
f26d000b-daff-49e0-bda4-1fb2dbf94484	739c79ab-9b9f-4d54-bc16-830e967f149a	1ba51d3e-52e7-40ec-878d-55a7d135bdad	4a0fc13b-85c0-4609-acbb-9a42b2670c8e	ff89f500-aa1c-419b-82e5-6faffdf7ae3a	52000.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 13:28:17.561038	2026-08-26 13:28:17.561038
4ab79d97-2766-4481-b540-feb0d8b4c8b3	93e8de5a-2b9b-4b98-b968-8a15369789eb	28158bd6-cd39-49a8-a0a9-58ec324473bc	5fa6e0ec-098a-417d-856f-187eb5aeaa4b	323d444a-8b41-479d-9e9c-cf7e5dcbfd1e	50005.00	CDF	VERIFIED	\N	\N	f	f	2026-08-26 18:35:10.605221	2026-08-26 18:35:10.605221
\.


--
-- Name: order_number_seq; Type: SEQUENCE SET; Schema: public; Owner: btmi_user
--

SELECT pg_catalog.setval('public.order_number_seq', 1144, true);


--
-- Name: account_activation_tokens account_activation_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.account_activation_tokens
    ADD CONSTRAINT account_activation_tokens_pkey PRIMARY KEY (id);


--
-- Name: business_memberships business_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT business_memberships_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: buyer_levels buyer_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_levels
    ADD CONSTRAINT buyer_levels_name_key UNIQUE (name);


--
-- Name: buyer_levels buyer_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_levels
    ADD CONSTRAINT buyer_levels_pkey PRIMARY KEY (id);


--
-- Name: buyer_payments buyer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_payments
    ADD CONSTRAINT buyer_payments_pkey PRIMARY KEY (id);


--
-- Name: buyer_profiles buyer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT buyer_profiles_pkey PRIMARY KEY (id);


--
-- Name: buyer_profiles buyer_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT buyer_profiles_user_id_key UNIQUE (user_id);


--
-- Name: cash_payments cash_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_pkey PRIMARY KEY (id);


--
-- Name: cash_sessions cash_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employee_activation_tokens employee_activation_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_activation_tokens
    ADD CONSTRAINT employee_activation_tokens_pkey PRIMARY KEY (id);


--
-- Name: employee_invitations employee_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_invitations
    ADD CONSTRAINT employee_invitations_pkey PRIMARY KEY (id);


--
-- Name: employee_shop_assignments employee_shop_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT employee_shop_assignments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_shop_variant_unique; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_shop_variant_unique UNIQUE (shop_id, variant_id);


--
-- Name: level_benefits level_benefits_level_type_level_name_benefit_type_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.level_benefits
    ADD CONSTRAINT level_benefits_level_type_level_name_benefit_type_key UNIQUE (level_type, level_name, benefit_type);


--
-- Name: level_benefits level_benefits_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.level_benefits
    ADD CONSTRAINT level_benefits_pkey PRIMARY KEY (id);


--
-- Name: order_lines order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: point_accounts point_accounts_owner_type_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.point_accounts
    ADD CONSTRAINT point_accounts_owner_type_owner_id_key UNIQUE (owner_type, owner_id);


--
-- Name: point_accounts point_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.point_accounts
    ADD CONSTRAINT point_accounts_pkey PRIMARY KEY (id);


--
-- Name: point_config point_config_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.point_config
    ADD CONSTRAINT point_config_pkey PRIMARY KEY (key);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_review_aggregates product_review_aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_review_aggregates
    ADD CONSTRAINT product_review_aggregates_pkey PRIMARY KEY (product_id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_confirmations purchase_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.purchase_confirmations
    ADD CONSTRAINT purchase_confirmations_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: review_helpful_votes review_helpful_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (review_id, user_id);


--
-- Name: review_history review_history_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_history
    ADD CONSTRAINT review_history_pkey PRIMARY KEY (id);


--
-- Name: review_replies review_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seller_levels seller_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_levels
    ADD CONSTRAINT seller_levels_name_key UNIQUE (name);


--
-- Name: seller_levels seller_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_levels
    ADD CONSTRAINT seller_levels_pkey PRIMARY KEY (id);


--
-- Name: seller_reviews seller_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_pkey PRIMARY KEY (id);


--
-- Name: seller_trust seller_trust_business_id_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_trust
    ADD CONSTRAINT seller_trust_business_id_key UNIQUE (business_id);


--
-- Name: seller_trust seller_trust_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_trust
    ADD CONSTRAINT seller_trust_pkey PRIMARY KEY (id);


--
-- Name: shop_review_aggregates shop_review_aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.shop_review_aggregates
    ADD CONSTRAINT shop_review_aggregates_pkey PRIMARY KEY (shop_id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_receipt_lines stock_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipt_lines
    ADD CONSTRAINT stock_receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_receipts stock_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: employee_shop_assignments unique_employee_shop; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT unique_employee_shop UNIQUE (employee_id, shop_id);


--
-- Name: subcategories unique_subcategory_per_category; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT unique_subcategory_per_category UNIQUE (category_id, slug);


--
-- Name: business_memberships unique_user_business; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT unique_user_business UNIQUE (user_id, business_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verified_transactions verified_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.verified_transactions
    ADD CONSTRAINT verified_transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_activation_tokens_expires_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_activation_tokens_expires_at ON public.account_activation_tokens USING btree (expires_at);


--
-- Name: idx_activation_tokens_token_hash; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_activation_tokens_token_hash ON public.account_activation_tokens USING btree (token_hash);


--
-- Name: idx_activation_tokens_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_activation_tokens_user_id ON public.account_activation_tokens USING btree (user_id);


--
-- Name: idx_assignments_employee_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_assignments_employee_id ON public.employee_shop_assignments USING btree (employee_id);


--
-- Name: idx_assignments_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_assignments_shop_id ON public.employee_shop_assignments USING btree (shop_id);


--
-- Name: idx_assignments_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_assignments_status ON public.employee_shop_assignments USING btree (status);


--
-- Name: idx_businesses_name; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_businesses_name ON public.businesses USING btree (name);


--
-- Name: idx_businesses_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_businesses_status ON public.businesses USING btree (status);


--
-- Name: idx_buyer_payments_buyer; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_buyer_payments_buyer ON public.buyer_payments USING btree (buyer_profile_id);


--
-- Name: idx_buyer_payments_order_unique; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX idx_buyer_payments_order_unique ON public.buyer_payments USING btree (order_id);


--
-- Name: idx_buyer_payments_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_buyer_payments_status ON public.buyer_payments USING btree (status);


--
-- Name: idx_buyer_profiles_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_buyer_profiles_user_id ON public.buyer_profiles USING btree (user_id);


--
-- Name: idx_cash_payments_business; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_business ON public.cash_payments USING btree (business_id);


--
-- Name: idx_cash_payments_created; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_created ON public.cash_payments USING btree (created_at);


--
-- Name: idx_cash_payments_employee; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_employee ON public.cash_payments USING btree (employee_id);


--
-- Name: idx_cash_payments_reference; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_reference ON public.cash_payments USING btree (reference_type, reference_id);


--
-- Name: idx_cash_payments_session; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_session ON public.cash_payments USING btree (cash_session_id);


--
-- Name: idx_cash_payments_shop; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_shop ON public.cash_payments USING btree (shop_id);


--
-- Name: idx_cash_payments_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_payments_status ON public.cash_payments USING btree (status);


--
-- Name: idx_cash_sessions_business; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_sessions_business ON public.cash_sessions USING btree (business_id);


--
-- Name: idx_cash_sessions_employee; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_sessions_employee ON public.cash_sessions USING btree (employee_id);


--
-- Name: idx_cash_sessions_shop; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_sessions_shop ON public.cash_sessions USING btree (shop_id);


--
-- Name: idx_cash_sessions_shop_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_sessions_shop_status ON public.cash_sessions USING btree (shop_id, status);


--
-- Name: idx_cash_sessions_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_cash_sessions_status ON public.cash_sessions USING btree (status);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_categories_sort; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_categories_sort ON public.categories USING btree (sort_order);


--
-- Name: idx_categories_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_categories_status ON public.categories USING btree (status);


--
-- Name: idx_customers_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_customers_business_id ON public.customers USING btree (business_id);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_employee_activation_tokens_token_hash; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employee_activation_tokens_token_hash ON public.employee_activation_tokens USING btree (token_hash);


--
-- Name: idx_employee_activation_tokens_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employee_activation_tokens_user_id ON public.employee_activation_tokens USING btree (user_id);


--
-- Name: idx_employee_invitations_employee_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employee_invitations_employee_id ON public.employee_invitations USING btree (employee_id);


--
-- Name: idx_employee_invitations_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employee_invitations_status ON public.employee_invitations USING btree (status);


--
-- Name: idx_employee_invitations_token_hash; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employee_invitations_token_hash ON public.employee_invitations USING btree (token_hash);


--
-- Name: idx_employees_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employees_business_id ON public.employees USING btree (business_id);


--
-- Name: idx_employees_linked_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employees_linked_user_id ON public.employees USING btree (linked_user_id);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_inventory_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_inventory_business_id ON public.inventory USING btree (business_id);


--
-- Name: idx_inventory_product_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_inventory_product_id ON public.inventory USING btree (product_id);


--
-- Name: idx_inventory_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_inventory_shop_id ON public.inventory USING btree (shop_id);


--
-- Name: idx_memberships_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_memberships_business_id ON public.business_memberships USING btree (business_id);


--
-- Name: idx_memberships_role; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_memberships_role ON public.business_memberships USING btree (role);


--
-- Name: idx_memberships_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_memberships_status ON public.business_memberships USING btree (status);


--
-- Name: idx_memberships_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_memberships_user_id ON public.business_memberships USING btree (user_id);


--
-- Name: idx_order_lines_order_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_order_lines_order_id ON public.order_lines USING btree (order_id);


--
-- Name: idx_order_lines_product_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_order_lines_product_id ON public.order_lines USING btree (product_id);


--
-- Name: idx_order_lines_variant_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_order_lines_variant_id ON public.order_lines USING btree (variant_id);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_business_id ON public.orders USING btree (business_id);


--
-- Name: idx_orders_buyer_profile_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_buyer_profile_id ON public.orders USING btree (buyer_profile_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_idempotency_key; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX idx_orders_idempotency_key ON public.orders USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX idx_orders_order_number ON public.orders USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: idx_orders_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_shop_id ON public.orders USING btree (shop_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token_hash; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_point_accounts_owner; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_point_accounts_owner ON public.point_accounts USING btree (owner_type, owner_id);


--
-- Name: idx_point_transactions_account; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_point_transactions_account ON public.point_transactions USING btree (point_account_id);


--
-- Name: idx_point_transactions_reference; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_point_transactions_reference ON public.point_transactions USING btree (reference_type, reference_id);


--
-- Name: idx_product_images_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_product_images_business_id ON public.product_images USING btree (business_id);


--
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


--
-- Name: idx_product_images_variant_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_product_images_variant_id ON public.product_images USING btree (variant_id);


--
-- Name: idx_product_review_aggregates_rating; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_product_review_aggregates_rating ON public.product_review_aggregates USING btree (average_rating DESC, total_reviews DESC);


--
-- Name: idx_products_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_business_id ON public.products USING btree (business_id);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_publication_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_publication_status ON public.products USING btree (publication_status);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_products_subcategory_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_products_subcategory_id ON public.products USING btree (subcategory_id);


--
-- Name: idx_purchase_confirmations_buyer; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_purchase_confirmations_buyer ON public.purchase_confirmations USING btree (buyer_profile_id);


--
-- Name: idx_purchase_confirmations_order; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_purchase_confirmations_order ON public.purchase_confirmations USING btree (order_id);


--
-- Name: idx_purchase_confirmations_unique; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX idx_purchase_confirmations_unique ON public.purchase_confirmations USING btree (order_id, buyer_profile_id);


--
-- Name: idx_receipt_lines_receipt_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_receipt_lines_receipt_id ON public.stock_receipt_lines USING btree (receipt_id);


--
-- Name: idx_receipt_lines_variant_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_receipt_lines_variant_id ON public.stock_receipt_lines USING btree (variant_id);


--
-- Name: idx_receipts_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_receipts_business_id ON public.stock_receipts USING btree (business_id);


--
-- Name: idx_receipts_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_receipts_shop_id ON public.stock_receipts USING btree (shop_id);


--
-- Name: idx_receipts_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_receipts_status ON public.stock_receipts USING btree (status);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_review_history_review_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_review_history_review_id ON public.review_history USING btree (review_id);


--
-- Name: idx_review_replies_review; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_review_replies_review ON public.review_replies USING btree (review_id, created_at);


--
-- Name: idx_seller_reviews_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_business_id ON public.seller_reviews USING btree (business_id);


--
-- Name: idx_seller_reviews_buyer_profile_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_buyer_profile_id ON public.seller_reviews USING btree (buyer_profile_id);


--
-- Name: idx_seller_reviews_created_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_created_at ON public.seller_reviews USING btree (created_at);


--
-- Name: idx_seller_reviews_product_active; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_product_active ON public.seller_reviews USING btree (product_id, status, created_at DESC);


--
-- Name: idx_seller_reviews_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_shop_id ON public.seller_reviews USING btree (shop_id);


--
-- Name: idx_seller_reviews_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_seller_reviews_status ON public.seller_reviews USING btree (status);


--
-- Name: idx_shops_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_shops_business_id ON public.shops USING btree (business_id);


--
-- Name: idx_shops_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_shops_status ON public.shops USING btree (status);


--
-- Name: idx_stock_movements_business_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_business_id ON public.stock_movements USING btree (business_id);


--
-- Name: idx_stock_movements_created_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at);


--
-- Name: idx_stock_movements_movement_type; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_movement_type ON public.stock_movements USING btree (movement_type);


--
-- Name: idx_stock_movements_product_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);


--
-- Name: idx_stock_movements_shop_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_shop_id ON public.stock_movements USING btree (shop_id);


--
-- Name: idx_stock_movements_variant_id_created_at; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_stock_movements_variant_id_created_at ON public.stock_movements USING btree (variant_id, created_at);


--
-- Name: idx_subcategories_category_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_subcategories_category_id ON public.subcategories USING btree (category_id);


--
-- Name: idx_subcategories_slug; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_subcategories_slug ON public.subcategories USING btree (slug);


--
-- Name: idx_subcategories_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_subcategories_status ON public.subcategories USING btree (status);


--
-- Name: idx_users_account_type; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_users_account_type ON public.users USING btree (account_type);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_variants_barcode; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_variants_barcode ON public.product_variants USING btree (barcode);


--
-- Name: idx_variants_product_id; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: idx_variants_sku; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_variants_sku ON public.product_variants USING btree (sku);


--
-- Name: idx_variants_status; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_variants_status ON public.product_variants USING btree (status);


--
-- Name: idx_verified_transactions_business; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_verified_transactions_business ON public.verified_transactions USING btree (business_id);


--
-- Name: idx_verified_transactions_buyer; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_verified_transactions_buyer ON public.verified_transactions USING btree (buyer_profile_id);


--
-- Name: idx_verified_transactions_order; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE INDEX idx_verified_transactions_order ON public.verified_transactions USING btree (order_id);


--
-- Name: idx_verified_transactions_order_unique; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX idx_verified_transactions_order_unique ON public.verified_transactions USING btree (order_id) WHERE ((status)::text <> 'REFUNDED'::text);


--
-- Name: uq_customer_email_business; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX uq_customer_email_business ON public.customers USING btree (business_id, email) WHERE ((email IS NOT NULL) AND ((email)::text <> ''::text));


--
-- Name: uq_customer_phone_business; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX uq_customer_phone_business ON public.customers USING btree (business_id, phone) WHERE ((phone IS NOT NULL) AND ((phone)::text <> ''::text));


--
-- Name: uq_seller_reviews_order_experience; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX uq_seller_reviews_order_experience ON public.seller_reviews USING btree (order_id) WHERE (order_line_id IS NULL);


--
-- Name: uq_seller_reviews_order_line; Type: INDEX; Schema: public; Owner: btmi_user
--

CREATE UNIQUE INDEX uq_seller_reviews_order_line ON public.seller_reviews USING btree (order_line_id) WHERE (order_line_id IS NOT NULL);


--
-- Name: account_activation_tokens account_activation_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.account_activation_tokens
    ADD CONSTRAINT account_activation_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: business_memberships business_memberships_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT business_memberships_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_memberships business_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT business_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buyer_payments buyer_payments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_payments
    ADD CONSTRAINT buyer_payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: buyer_payments buyer_payments_buyer_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_payments
    ADD CONSTRAINT buyer_payments_buyer_profile_id_fkey FOREIGN KEY (buyer_profile_id) REFERENCES public.buyer_profiles(id);


--
-- Name: buyer_payments buyer_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_payments
    ADD CONSTRAINT buyer_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: buyer_payments buyer_payments_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_payments
    ADD CONSTRAINT buyer_payments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: buyer_profiles buyer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT buyer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cash_payments cash_payments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: cash_payments cash_payments_cash_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id);


--
-- Name: cash_payments cash_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: cash_payments cash_payments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: cash_payments cash_payments_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_payments
    ADD CONSTRAINT cash_payments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: cash_sessions cash_sessions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: cash_sessions cash_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: cash_sessions cash_sessions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: customers customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_activation_tokens employee_activation_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_activation_tokens
    ADD CONSTRAINT employee_activation_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_invitations employee_invitations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_invitations
    ADD CONSTRAINT employee_invitations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_shop_assignments employee_shop_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT employee_shop_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_shop_assignments employee_shop_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT employee_shop_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_shop_assignments employee_shop_assignments_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT employee_shop_assignments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: employees employees_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employees employees_linked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_shop_assignments fk_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT fk_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: business_memberships fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customers fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employees fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: inventory fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: products fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: shops fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stock_movements fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stock_receipts fk_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_shop_assignments fk_employee; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: stock_movements fk_employee; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: employees fk_linked_user; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_linked_user FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements fk_performed_by; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_performed_by FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory fk_product; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_variants fk_product; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements fk_product; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images fk_product_images_business; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT fk_product_images_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: product_images fk_product_images_product; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images fk_product_images_variant; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT fk_product_images_variant FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: product_review_aggregates fk_product_review_aggregates_product; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_review_aggregates
    ADD CONSTRAINT fk_product_review_aggregates_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_receipt_lines fk_receipt; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipt_lines
    ADD CONSTRAINT fk_receipt FOREIGN KEY (receipt_id) REFERENCES public.stock_receipts(id) ON DELETE CASCADE;


--
-- Name: employee_shop_assignments fk_shop; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.employee_shop_assignments
    ADD CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: inventory fk_shop; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: stock_movements fk_shop; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: stock_receipts fk_shop; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: account_activation_tokens fk_user; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.account_activation_tokens
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: business_memberships fk_user; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.business_memberships
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens fk_user; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_user; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_receipt_lines fk_variant; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipt_lines
    ADD CONSTRAINT fk_variant FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_point_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_point_account_id_fkey FOREIGN KEY (point_account_id) REFERENCES public.point_accounts(id);


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;


--
-- Name: purchase_confirmations purchase_confirmations_buyer_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.purchase_confirmations
    ADD CONSTRAINT purchase_confirmations_buyer_profile_id_fkey FOREIGN KEY (buyer_profile_id) REFERENCES public.buyer_profiles(id);


--
-- Name: purchase_confirmations purchase_confirmations_cash_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.purchase_confirmations
    ADD CONSTRAINT purchase_confirmations_cash_payment_id_fkey FOREIGN KEY (cash_payment_id) REFERENCES public.cash_payments(id);


--
-- Name: purchase_confirmations purchase_confirmations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.purchase_confirmations
    ADD CONSTRAINT purchase_confirmations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.seller_reviews(id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_history review_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_history
    ADD CONSTRAINT review_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: review_history review_history_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_history
    ADD CONSTRAINT review_history_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.seller_reviews(id);


--
-- Name: review_replies review_replies_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.seller_reviews(id) ON DELETE CASCADE;


--
-- Name: review_replies review_replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_reviews seller_reviews_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: seller_reviews seller_reviews_buyer_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_buyer_profile_id_fkey FOREIGN KEY (buyer_profile_id) REFERENCES public.buyer_profiles(id);


--
-- Name: seller_reviews seller_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: seller_reviews seller_reviews_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_order_line_id_fkey FOREIGN KEY (order_line_id) REFERENCES public.order_lines(id) ON DELETE CASCADE;


--
-- Name: seller_reviews seller_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: seller_reviews seller_reviews_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: seller_reviews seller_reviews_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: seller_trust seller_trust_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.seller_trust
    ADD CONSTRAINT seller_trust_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: shop_review_aggregates shop_review_aggregates_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.shop_review_aggregates
    ADD CONSTRAINT shop_review_aggregates_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: shops shops_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: stock_receipt_lines stock_receipt_lines_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipt_lines
    ADD CONSTRAINT stock_receipt_lines_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.stock_receipts(id) ON DELETE CASCADE;


--
-- Name: stock_receipt_lines stock_receipt_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipt_lines
    ADD CONSTRAINT stock_receipt_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: stock_receipts stock_receipts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: stock_receipts stock_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_receipts stock_receipts_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: verified_transactions verified_transactions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.verified_transactions
    ADD CONSTRAINT verified_transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: verified_transactions verified_transactions_buyer_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.verified_transactions
    ADD CONSTRAINT verified_transactions_buyer_profile_id_fkey FOREIGN KEY (buyer_profile_id) REFERENCES public.buyer_profiles(id);


--
-- Name: verified_transactions verified_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.verified_transactions
    ADD CONSTRAINT verified_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: verified_transactions verified_transactions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: btmi_user
--

ALTER TABLE ONLY public.verified_transactions
    ADD CONSTRAINT verified_transactions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- PostgreSQL database dump complete
--

\unrestrict p9qAJpePTva1e6v6kdZWLeqlgmFZiubbTckbgtdGjohIWqxM1I4vbyOs0Ok8OIt


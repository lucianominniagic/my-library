--
-- PostgreSQL database dump
--

\restrict Qwl9ZOx3IqfJAnQUHN5cGe1G8vVf0iHmIqMYoPfAg3WVooVfYzP8o6vXyM7nTgF

-- Dumped from database version 16.13
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-14 11:56:38

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 19044)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 5102 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 3 (class 3079 OID 19125)
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- TOC entry 5103 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- TOC entry 4 (class 3079 OID 19132)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5104 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 278 (class 1255 OID 19143)
-- Name: f_unaccent(text); Type: FUNCTION; Schema: public; Owner: postgres
--

SET search_path = public, pg_catalog;

CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT unaccent('unaccent', $1) $_$;


ALTER FUNCTION public.f_unaccent(text) OWNER TO postgres;

--
-- TOC entry 279 (class 1255 OID 19144)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 19145)
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 19151)
-- Name: authors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    nationality text,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    bio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.authors OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 19160)
-- Name: book_authors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.book_authors (
    book_id uuid NOT NULL,
    author_id uuid NOT NULL,
    role text DEFAULT 'author'::text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    CONSTRAINT chk_ba_role CHECK ((role = ANY (ARRAY['author'::text, 'editor'::text, 'translator'::text, 'illustrator'::text, 'other'::text])))
);


ALTER TABLE public.book_authors OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 19168)
-- Name: book_covers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.book_covers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    book_id uuid,
    mime_type text NOT NULL,
    data bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.book_covers OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 19175)
-- Name: book_genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.book_genres (
    book_id uuid NOT NULL,
    genre_id uuid NOT NULL
);


ALTER TABLE public.book_genres OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 19178)
-- Name: book_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.book_tags (
    book_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.book_tags OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 19181)
-- Name: books; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.books (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    subtitle text,
    isbn text,
    publisher text,
    published_year smallint,
    language character(2) DEFAULT 'it'::bpchar NOT NULL,
    pages integer,
    description text,
    cover_url text,
    year_read smallint,
    rating smallint,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fts_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('italian'::regconfig, public.f_unaccent(COALESCE(title, ''::text))), 'A'::"char") || setweight(to_tsvector('italian'::regconfig, public.f_unaccent(COALESCE(subtitle, ''::text))), 'B'::"char")) || setweight(to_tsvector('italian'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char"))) STORED,
    title_en text,
    CONSTRAINT chk_books_language CHECK ((language ~ '^[a-z]{2}$'::text)),
    CONSTRAINT chk_books_pub_year CHECK (((published_year IS NULL) OR ((published_year >= 0) AND (published_year <= 2200)))),
    CONSTRAINT chk_books_rating CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5)))),
    CONSTRAINT chk_books_year_read CHECK (((year_read IS NULL) OR ((year_read >= 1800) AND (year_read <= 2200))))
);


ALTER TABLE public.books OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 19195)
-- Name: genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.genres (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL
);


ALTER TABLE public.genres OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 19202)
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 19207)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- TOC entry 5105 (class 0 OID 0)
-- Dependencies: 227
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 228 (class 1259 OID 19208)
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    expires timestamp with time zone NOT NULL,
    session_token text NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 19214)
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color character(7),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tags_color CHECK (((color IS NULL) OR (color ~ '^#[0-9A-Fa-f]{6}$'::text)))
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 19222)
-- Name: typeorm_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.typeorm_metadata (
    type character varying NOT NULL,
    database character varying,
    schema character varying,
    "table" character varying,
    name character varying,
    value text
);


ALTER TABLE public.typeorm_metadata OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 19227)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text,
    email text,
    email_verified timestamp with time zone,
    image text,
    password_hash text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 19233)
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp with time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- TOC entry 4872 (class 2604 OID 19238)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 4920 (class 2606 OID 19240)
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- TOC entry 4885 (class 2606 OID 19242)
-- Name: accounts pk_accounts; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT pk_accounts PRIMARY KEY (id);


--
-- TOC entry 4891 (class 2606 OID 19244)
-- Name: authors pk_authors; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authors
    ADD CONSTRAINT pk_authors PRIMARY KEY (id);


--
-- TOC entry 4894 (class 2606 OID 19246)
-- Name: book_authors pk_book_authors; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_authors
    ADD CONSTRAINT pk_book_authors PRIMARY KEY (book_id, author_id);


--
-- TOC entry 4897 (class 2606 OID 19248)
-- Name: book_covers pk_book_covers; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_covers
    ADD CONSTRAINT pk_book_covers PRIMARY KEY (id);


--
-- TOC entry 4900 (class 2606 OID 19250)
-- Name: book_genres pk_book_genres; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_genres
    ADD CONSTRAINT pk_book_genres PRIMARY KEY (book_id, genre_id);


--
-- TOC entry 4903 (class 2606 OID 19252)
-- Name: book_tags pk_book_tags; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_tags
    ADD CONSTRAINT pk_book_tags PRIMARY KEY (book_id, tag_id);


--
-- TOC entry 4912 (class 2606 OID 19254)
-- Name: books pk_books; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT pk_books PRIMARY KEY (id);


--
-- TOC entry 4914 (class 2606 OID 19256)
-- Name: genres pk_genres; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT pk_genres PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 19258)
-- Name: sessions pk_sessions; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT pk_sessions PRIMARY KEY (id);


--
-- TOC entry 4928 (class 2606 OID 19260)
-- Name: tags pk_tags; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT pk_tags PRIMARY KEY (id);


--
-- TOC entry 4934 (class 2606 OID 19262)
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 19264)
-- Name: verification_tokens pk_verification_tokens; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT pk_verification_tokens PRIMARY KEY (token);


--
-- TOC entry 4887 (class 2606 OID 19266)
-- Name: accounts uq_accounts_provider; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT uq_accounts_provider UNIQUE (provider, provider_account_id);


--
-- TOC entry 4916 (class 2606 OID 19268)
-- Name: genres uq_genres_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT uq_genres_name UNIQUE (name);


--
-- TOC entry 4918 (class 2606 OID 19270)
-- Name: genres uq_genres_slug; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT uq_genres_slug UNIQUE (slug);


--
-- TOC entry 4925 (class 2606 OID 19272)
-- Name: sessions uq_sessions_token; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT uq_sessions_token UNIQUE (session_token);


--
-- TOC entry 4930 (class 2606 OID 19274)
-- Name: tags uq_tags_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT uq_tags_name UNIQUE (user_id, name);


--
-- TOC entry 4932 (class 2606 OID 19276)
-- Name: tags uq_tags_slug; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT uq_tags_slug UNIQUE (user_id, slug);


--
-- TOC entry 4936 (class 2606 OID 19278)
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- TOC entry 4940 (class 2606 OID 19280)
-- Name: verification_tokens uq_verif_token_ident; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT uq_verif_token_ident UNIQUE (identifier, token);


--
-- TOC entry 4883 (class 1259 OID 19281)
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);


--
-- TOC entry 4888 (class 1259 OID 19282)
-- Name: idx_authors_aliases_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_authors_aliases_gin ON public.authors USING gin (aliases);


--
-- TOC entry 4889 (class 1259 OID 19283)
-- Name: idx_authors_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_authors_name_trgm ON public.authors USING gin (public.f_unaccent(name) public.gin_trgm_ops);


--
-- TOC entry 4892 (class 1259 OID 19284)
-- Name: idx_book_authors_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_book_authors_author_id ON public.book_authors USING btree (author_id);


--
-- TOC entry 4895 (class 1259 OID 19285)
-- Name: idx_book_covers_book_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_book_covers_book_id ON public.book_covers USING btree (book_id);


--
-- TOC entry 4898 (class 1259 OID 19286)
-- Name: idx_book_genres_genre_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_book_genres_genre_id ON public.book_genres USING btree (genre_id);


--
-- TOC entry 4901 (class 1259 OID 19287)
-- Name: idx_book_tags_tag_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_book_tags_tag_id ON public.book_tags USING btree (tag_id);


--
-- TOC entry 4904 (class 1259 OID 19288)
-- Name: idx_books_fts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_fts ON public.books USING gin (fts_vector);


--
-- TOC entry 4905 (class 1259 OID 19289)
-- Name: idx_books_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_rating ON public.books USING btree (user_id, rating) WHERE (rating IS NOT NULL);


--
-- TOC entry 4906 (class 1259 OID 19290)
-- Name: idx_books_read_by_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_read_by_year ON public.books USING btree (user_id, year_read DESC) WHERE (year_read IS NOT NULL);


--
-- TOC entry 4907 (class 1259 OID 19291)
-- Name: idx_books_subtitle_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_subtitle_trgm ON public.books USING gin (public.f_unaccent(subtitle) public.gin_trgm_ops) WHERE (subtitle IS NOT NULL);


--
-- TOC entry 4908 (class 1259 OID 19292)
-- Name: idx_books_tbr; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_tbr ON public.books USING btree (user_id, created_at DESC) WHERE (year_read IS NULL);


--
-- TOC entry 4909 (class 1259 OID 19293)
-- Name: idx_books_title_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_title_trgm ON public.books USING gin (public.f_unaccent(title) public.gin_trgm_ops);


--
-- TOC entry 4910 (class 1259 OID 19294)
-- Name: idx_books_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_books_user_id ON public.books USING btree (user_id);


--
-- TOC entry 4921 (class 1259 OID 19295)
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- TOC entry 4926 (class 1259 OID 19296)
-- Name: idx_tags_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tags_user_id ON public.tags USING btree (user_id);


--
-- TOC entry 4952 (class 2620 OID 19297)
-- Name: authors trg_authors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_authors_updated_at BEFORE UPDATE ON public.authors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4953 (class 2620 OID 19298)
-- Name: books trg_books_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4941 (class 2606 OID 19299)
-- Name: accounts fk_accounts_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4942 (class 2606 OID 19304)
-- Name: book_authors fk_ba_author; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_authors
    ADD CONSTRAINT fk_ba_author FOREIGN KEY (author_id) REFERENCES public.authors(id) ON DELETE RESTRICT;


--
-- TOC entry 4943 (class 2606 OID 19309)
-- Name: book_authors fk_ba_book; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_authors
    ADD CONSTRAINT fk_ba_book FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- TOC entry 4945 (class 2606 OID 19314)
-- Name: book_genres fk_bg_book; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_genres
    ADD CONSTRAINT fk_bg_book FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- TOC entry 4946 (class 2606 OID 19319)
-- Name: book_genres fk_bg_genre; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_genres
    ADD CONSTRAINT fk_bg_genre FOREIGN KEY (genre_id) REFERENCES public.genres(id) ON DELETE RESTRICT;


--
-- TOC entry 4944 (class 2606 OID 19324)
-- Name: book_covers fk_book_covers_book; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_covers
    ADD CONSTRAINT fk_book_covers_book FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- TOC entry 4949 (class 2606 OID 19329)
-- Name: books fk_books_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT fk_books_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4947 (class 2606 OID 19334)
-- Name: book_tags fk_bt_book; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_tags
    ADD CONSTRAINT fk_bt_book FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- TOC entry 4948 (class 2606 OID 19339)
-- Name: book_tags fk_bt_tag; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.book_tags
    ADD CONSTRAINT fk_bt_tag FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- TOC entry 4950 (class 2606 OID 19344)
-- Name: sessions fk_sessions_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4951 (class 2606 OID 19349)
-- Name: tags fk_tags_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-05-14 11:56:38

--
-- PostgreSQL database dump complete
--

\unrestrict Qwl9ZOx3IqfJAnQUHN5cGe1G8vVf0iHmIqMYoPfAg3WVooVfYzP8o6vXyM7nTgF


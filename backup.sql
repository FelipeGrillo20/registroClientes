--
-- PostgreSQL database dump
--

\restrict qMUEXOQjbovyoDxyBB2FKlA5gP5QntlGmDeb8dT4AS4Dqh0Jg8OLAPbXWWKRoei

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    cedula character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    sede character varying(100) NOT NULL,
    actividad character varying(100),
    modalidad character varying(20),
    fecha date,
    columna1 character varying(255),
    estado character varying(20),
    email character varying(150) NOT NULL,
    telefono character varying(20) NOT NULL,
    contacto_emergencia_nombre character varying(255),
    contacto_emergencia_parentesco character varying(100),
    contacto_emergencia_telefono character varying(20),
    vinculo character varying(50),
    empresa_id integer,
    tipo_entidad_pagadora character varying(50),
    entidad_pagadora_especifica character varying(100),
    CONSTRAINT clients_estado_check CHECK (((estado)::text = ANY ((ARRAY['Abierto'::character varying, 'Cerrado'::character varying])::text[]))),
    CONSTRAINT clients_modalidad_check CHECK (((modalidad)::text = ANY ((ARRAY['Virtual'::character varying, 'Presencial'::character varying])::text[])))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: COLUMN clients.vinculo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.vinculo IS 'Valores: Trabajador o Familiar Trabajador';


--
-- Name: COLUMN clients.tipo_entidad_pagadora; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.tipo_entidad_pagadora IS 'Tipo de entidad: Particular, ARL o CCF';


--
-- Name: COLUMN clients.entidad_pagadora_especifica; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.entidad_pagadora_especifica IS 'Nombre específico de la ARL o CCF (null si es Particular)';


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: consultas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultas (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    actividad text NOT NULL,
    modalidad character varying(20) NOT NULL,
    fecha date NOT NULL,
    columna1 text,
    estado character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    motivo_consulta character varying(100),
    consulta_number integer DEFAULT 1 NOT NULL,
    CONSTRAINT consultas_estado_check CHECK (((estado)::text = ANY ((ARRAY['Abierto'::character varying, 'Cerrado'::character varying])::text[]))),
    CONSTRAINT consultas_modalidad_check CHECK (((modalidad)::text = ANY ((ARRAY['Virtual'::character varying, 'Presencial'::character varying])::text[])))
);


ALTER TABLE public.consultas OWNER TO postgres;

--
-- Name: consultas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.consultas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consultas_id_seq OWNER TO postgres;

--
-- Name: consultas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.consultas_id_seq OWNED BY public.consultas.id;


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresas (
    id integer NOT NULL,
    tipo_cliente character varying(50) NOT NULL,
    nombre_cliente character varying(100) NOT NULL,
    cliente_final character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.empresas OWNER TO postgres;

--
-- Name: empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresas_id_seq OWNER TO postgres;

--
-- Name: empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empresas_id_seq OWNED BY public.empresas.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    cedula character varying(20) NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(255) NOT NULL,
    rol character varying(50) DEFAULT 'profesional'::character varying,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: consultas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas ALTER COLUMN id SET DEFAULT nextval('public.consultas_id_seq'::regclass);


--
-- Name: empresas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas ALTER COLUMN id SET DEFAULT nextval('public.empresas_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, cedula, nombre, sede, actividad, modalidad, fecha, columna1, estado, email, telefono, contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono, vinculo, empresa_id, tipo_entidad_pagadora, entidad_pagadora_especifica) FROM stdin;
96	11111111	Diego Grillo	Neiva	\N	\N	\N	\N	\N	diegogrillo@gmail.com	3182214067	\N	\N	\N	Trabajador	3	ARL	Sura
130	41455433	Ana Maria Sanin	Neiva	\N	\N	\N	\N	\N	anita@gmail.com	3182214067	\N	\N	\N	Trabajador	1	Particular	\N
131	1075222800	Hector Joven	Neiva	\N	\N	\N	\N	\N	hector@gmail.com	3182214069	Diego Grillo	Padre	31231231321	Trabajador	1	CCF	Compensar
132	19312310	Jose Simon Grillo	Neiva	\N	\N	\N	\N	\N	jose@gmail.com	3182214067	Diego Grillo	Hijo/a	3182214067	Trabajador	4	CCF	CAFAM
129	1075214835	Felipe Antonio Grillo Murillo	Neiva	\N	\N	\N	\N	\N	ing.felipegrillo@gmail.com	3182214067	Carolina Grillo	Hermano/a	31231231321	Trabajador	2	CCF	Compensar
93	36288147	Milena Gonzalez Gomez	Bogotá	\N	\N	\N	\N	\N	milena@stconsultores.net	3178871375	\N	\N	\N	Trabajador	4	CCF	CAFAM
134	41488449	Maira Esquivel	Barranquilla	\N	\N	\N	\N	\N	maria.esquivel@gmail.com	3178871375	\N	\N	\N	Trabajador	2	ARL	Positiva
133	1030680620	Valentina Narvaez	Neiva	\N	\N	\N	\N	\N	grillo@gmail.com	3182214067	Felipe Grillo	Pareja	3182214067	Trabajador	2	CCF	Compensar
135	19312311	Felipe Antonio Grillo Murillo	Neiva	\N	\N	\N	\N	\N	felipegrillomurillo@gmail.com	3182214069	\N	\N	\N	Trabajador	2	CCF	Compensar
\.


--
-- Data for Name: consultas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consultas (id, cliente_id, actividad, modalidad, fecha, columna1, estado, created_at, updated_at, motivo_consulta, consulta_number) FROM stdin;
173	133	DUELO Y PROBLEMÁTICA FAMILIAR	Presencial	2025-11-10	Prueba 2	Cerrado	2025-11-07 08:10:26.258619	2025-11-08 21:51:35.244682	DUELO Y PROBLEMÁTICA FAMILIAR	1
171	133	DUELO Y PROBLEMÁTICA FAMILIAR	Virtual	2025-11-07	Prueba 1	Cerrado	2025-11-07 08:06:52.791275	2025-11-08 21:51:35.246514	DUELO Y PROBLEMÁTICA FAMILIAR	1
167	129	DEPRESIÓN	Virtual	2025-11-04	Felipe lo dejo la novia	Abierto	2025-11-04 20:12:01.716389	2025-11-10 16:12:20.468193	DEPRESIÓN	1
168	129	DEPRESIÓN	Presencial	2025-11-04	Felipe se le murio el perro	Abierto	2025-11-04 20:12:34.11509	2025-11-10 16:12:20.54696	DEPRESIÓN	1
170	131	DEPRESIÓN	Virtual	2025-11-05	Prueba 2	Cerrado	2025-11-05 11:44:03.664143	2025-11-05 11:45:33.844226	DEPRESIÓN	1
169	131	DEPRESIÓN	Virtual	2025-11-05	Porque debe plata	Cerrado	2025-11-05 11:43:06.101884	2025-11-05 11:45:33.849832	DEPRESIÓN	1
152	93	DUELO	Presencial	2025-10-31	prueba 2	Cerrado	2025-10-30 18:32:41.174004	2025-10-30 18:33:26.149887	DUELO	1
151	93	DUELO	Presencial	2025-10-30	Prueba 1	Cerrado	2025-10-30 18:32:16.873922	2025-10-30 18:33:26.156634	DUELO	1
\.


--
-- Data for Name: empresas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empresas (id, tipo_cliente, nombre_cliente, cliente_final, activo, created_at) FROM stdin;
1	Particular	Guacamayas	Guacamayas	t	2025-10-27 23:40:11.946356
2	Particular	EPM	EPM	t	2025-10-27 23:40:11.946356
3	ARL	Sura	Alcaldía de Bogotá	t	2025-10-27 23:40:11.946356
4	CCF	Colsubsidio	Transmilenio	t	2025-10-27 23:40:11.946356
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, cedula, nombre, email, password, rol, activo, created_at) FROM stdin;
4	1075214835	Felipe Antonio Grillo Murillo	ing.felipegrillo@gmail.com	$2b$10$ug1dkhj2iM/g9AQDoiiA7OMUbJaVDFg4WwKPucvmeHgXKYtqWrm0i	admin	t	2025-10-20 14:03:40.912112
6	41488449	Lina Maria Murillo Zuluaga	lina@gmail.com	$2b$10$jep8aCyW8DOuODylYbSBFOxjOwUtdl5uPTGHHJgVuKzlXFeeKMole	profesional	t	2025-11-08 20:39:23.010198
3	123456789	Laura Valentina Narváez Polanco	prueba@test.com	$2b$10$DuC6BlLhgZt65.s2rvDghuFfOXDAMRKNUIqy99HI5NmUhRlqWSy8C	admin	t	2025-10-19 22:43:58.271783
5	19312310	Jose Simon Grillo Ardila	linmarmurillo@gmail.com	$2b$10$j2GWwUPuz9lEYJTYHlj9S.vDJmibvEtVeOAUdFTPBW3TBsE4nVjxW	profesional	t	2025-11-07 22:40:40.754823
\.


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_id_seq', 135, true);


--
-- Name: consultas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.consultas_id_seq', 173, true);


--
-- Name: empresas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.empresas_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: clients clients_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_cedula_key UNIQUE (cedula);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: consultas consultas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT consultas_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: users users_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_cedula_key UNIQUE (cedula);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_cliente_consulta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cliente_consulta ON public.consultas USING btree (cliente_id, consulta_number);


--
-- Name: consultas fk_cliente; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultas
    ADD CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients fk_empresa; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qMUEXOQjbovyoDxyBB2FKlA5gP5QntlGmDeb8dT4AS4Dqh0Jg8OLAPbXWWKRoei


-- MedDoc - Repositório de Prontuários Médicos
-- Schema SQL para Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELAS
-- ============================================

-- Tabela de usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'revisor', 'atendente')),
    password_hash VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela de documentos
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    prontuario_code VARCHAR(50) NOT NULL,
    system_code VARCHAR(20) NOT NULL UNIQUE,
    document_date DATE NOT NULL,
    type VARCHAR(50) NOT NULL,
    origin_sector VARCHAR(50) NOT NULL DEFAULT 'Outro',
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_hash VARCHAR(64),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reproved', 'trash')),
    review_note TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    never_delete BOOLEAN DEFAULT false,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de versões de documentos (histórico)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    review_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de logs de acesso
CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    document_id UUID REFERENCES documents(id),
    details TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações do sistema
CREATE TABLE system_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    trash_after_days INTEGER NOT NULL DEFAULT 180,
    permanent_delete_after_days INTEGER NOT NULL DEFAULT 60,
    alert_review_hours INTEGER NOT NULL DEFAULT 24,
    CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_cpf ON documents(cpf);
CREATE INDEX idx_documents_system_code ON documents(system_code);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Only admin can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Only admin can update users" ON users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Políticas para documents
CREATE POLICY "Documents view policy" ON documents
    FOR SELECT USING (
        -- Admin sees all
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        -- Revisor sees pending and approved
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'revisor') AND status IN ('pending', 'approved')
        -- Atendente sees own uploads and all approved
        OR uploaded_by = auth.uid()
        OR (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'atendente') AND status = 'approved')
    );

CREATE POLICY "Atendente can insert documents" ON documents
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('atendente', 'admin'))
    );

CREATE POLICY "Revisor can update document status" ON documents
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('revisor', 'admin'))
    );

-- Políticas para document_versions
CREATE POLICY "Document versions view policy" ON document_versions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
    );

-- Políticas para access_logs
CREATE POLICY "Only admin can view logs" ON access_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Authenticated can insert logs" ON access_logs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
    );

-- Políticas para system_config
CREATE POLICY "Only admin can view config" ON system_config
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Only admin can update config" ON system_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para documents
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar código do sistema automaticamente
CREATE OR REPLACE FUNCTION generate_system_code()
RETURNS TRIGGER AS $$
DECLARE
    year INTEGER;
    next_seq INTEGER;
BEGIN
    year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    SELECT COALESCE(MAX(CAST(SPLIT_PART(system_code, '-', 2) AS INTEGER)), 0) + 1
    INTO next_seq
    FROM documents
    WHERE system_code LIKE year || '-%';
    
    NEW.system_code := year || '-' || LPAD(next_seq::TEXT, 5, '0');
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para gerar código automático (opcional - descomente se quiser automático)
-- CREATE TRIGGER set_system_code
--     BEFORE INSERT ON documents
--     FOR EACH ROW
--     WHEN (NEW.system_code IS NULL)
--     EXECUTE FUNCTION generate_system_code();

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Configuração padrão
INSERT INTO system_config (id, trash_after_days, permanent_delete_after_days, alert_review_hours)
VALUES (1, 180, 60, 24)
ON CONFLICT (id) DO NOTHING;

-- Usuário admin padrão (senha: admin123)
-- Execute o comando abaixo via SQL Editor do Supabase após configurar:
-- INSERT INTO users (email, name, role, password_hash, active)
-- VALUES ('admin@clinica.com', 'Administrador', 'admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I2K', true);

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Criar bucket para documentos (execute via SQL Editor ou interface)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('medical-documents', 'medical-documents', false);

-- Políticas de storage
-- CREATE POLICY "Authenticated users can upload" ON storage.objects
--     FOR INSERT WITH CHECK (
        -- auth.role() = 'authenticated' AND bucket_id = 'medical-documents'
--     );

-- CREATE POLICY "Users can view own files" ON storage.objects
--     FOR SELECT USING (
        -- auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'medical-documents'
--     );

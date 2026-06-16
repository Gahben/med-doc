# Documentação da API das Edge Functions — MedDoc

Este documento descreve os endpoints, métodos, parâmetros, exemplos de requisição e resposta, e códigos de erro de todas as **Edge Functions** do MedDoc localizadas em `supabase/functions/`.

Todas as funções rodam no runtime **Deno** do Supabase e possuem suporte a CORS (método `OPTIONS`).

---

## Índice

1. [`invite-user`](#1-invite-user)
2. [`admin-actions`](#2-admin-actions)
3. [`workflow-webhook`](#3-workflow-webhook)
4. [`cron-clean-trash`](#4-cron-clean-trash)
5. [`ai-triage`](#5-ai-triage)
6. [`ai-audit-checklist`](#6-ai-audit-checklist)
7. [`ai-whatsapp-message`](#7-ai-whatsapp-message)

---

## 1. `invite-user`

Permite que administradores convidem novos usuários por e-mail para a plataforma com um papel (role) predefinido.

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/invite-user`
- **Headers:**
  - `Authorization: Bearer <JWT_DO_ADMIN>` (Exige token de usuário autenticado com perfil `admin`)
  - `Content-Type: application/json`

### Body (JSON)

| Campo | Tipo | Obrigatório | Padrão | Descrição |
| :--- | :---: | :---: | :--- | :--- |
| `email` | `string` | Sim | - | E-mail do usuário convidado |
| `role` | `string` | Não | `operador` | Papel de acesso: `admin`, `revisor`, `operador` ou `auditor` |
| `name` | `string` | Não | Parte do e-mail | Nome de exibição do usuário |

### Exemplo de Requisição

```json
{
  "email": "auditor.silva@hospital.com",
  "role": "auditor",
  "name": "Marcos Silva"
}
```

### Exemplo de Resposta (200 OK)

```json
{
  "ok": true,
  "user": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "email": "auditor.silva@hospital.com"
  }
}
```

---

## 2. `admin-actions`

Ações administrativas em lote ou que exigem privilégios de Service Role (bypass de RLS/Auth).

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/admin-actions`
- **Headers:**
  - `Authorization: Bearer <JWT_DO_ADMIN>` (Exige perfil `admin` ativo)
  - `Content-Type: application/json`

### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :---: | :---: | :--- |
| `action` | `string` | Sim | Ação a executar: `reset_password`, `delete_user` ou `update_role` |
| `target_user_id` | `string` | Sim | UUID do usuário alvo no Auth / Profiles |
| `role` | `string` | Condicional | Novo papel (obrigatório se `action === "update_role"`) |
| `active` | `boolean` | Condicional | Novo status de ativação (obrigatório se `action === "update_role"`) |

### Exemplo de Requisição (update_role)

```json
{
  "action": "update_role",
  "target_user_id": "f5d88691-3829-4ab3-9c88-293d09a27e32",
  "role": "revisor",
  "active": true
}
```

### Exemplo de Resposta (200 OK)

```json
{
  "ok": true,
  "changes": {
    "role": "revisor",
    "active": true
  }
}
```

---

## 3. `workflow-webhook`

API pública externa para que sistemas do hospital (sistemas de prontuário eletrônico PEP, barramentos de integração, etc.) atualizem o status do workflow de solicitações.

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/workflow-webhook`
- **Headers:**
  - `x-webhook-secret: <SECRET_CONFIGURADO>` (Exige segredo estático configurado em `WORKFLOW_WEBHOOK_SECRET`)
  - `Content-Type: application/json`

### Body (JSON)

Devem ser informados os identificadores (ou da solicitação de paciente, ou do prontuário do banco) e o novo status.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :---: | :---: | :--- |
| `workflow_status` | `string` | Sim | Novo status a aplicar (ex: `request_approved`, `in_production`, `concluded`) |
| `patient_request_id` | `string` | Não | ID da solicitação do paciente |
| `token` | `string` | Não | Token alfanumérico da solicitação |
| `prontuario_id` | `string` | Não | ID do prontuário no banco |
| `record_number` | `string` | Não | Número único do prontuário (`AAAAMMDD-XXXX`) |
| `caller_role` | `string` | Não | Identidade de quem executa (default: `admin`) |
| `note` | `string` | Não | Comentário / Observação sobre a transição |
| `auto_production_on_approve`| `boolean`| Não | Se `true` (padrão), ao aprovar uma solicitação, ela avança direto para `in_production` |

### Exemplo de Requisição

```json
{
  "token": "XYZA5678",
  "workflow_status": "concluded",
  "caller_role": "auditor",
  "note": "Aprovado na auditoria externa"
}
```

### Exemplo de Resposta (200 OK)

```json
{
  "success": true,
  "patient_request_id": "8c339798-2eb1-46bb-88b1-12c8ff46c071",
  "prontuario_id": "de00a89d-2921-4f1b-a9b0-4592a832103f",
  "previous_status": "in_audit",
  "workflow_status": "concluded"
}
```

---

## 4. `cron-clean-trash`

Função sem parâmetros acionada de forma agendada (Cron Job do Supabase) para realizar a limpeza física permanente de registros de prontuários colocados na lixeira (soft delete) há mais de 30 dias.

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/cron-clean-trash`
- **Headers:**
  - `Content-Type: application/json`

### Resposta (200 OK)

```json
{
  "success": true,
  "message": "Lixeira limpa com sucesso"
}
```

---

## 5. `ai-triage`

**Feature de IA:** Realiza a triagem automática inteligente de novas solicitações de prontuários enviadas por pacientes. Extrai a urgência, gera resumos e aponta inconsistências nos dados de entrada.

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/ai-triage`
- **Headers:**
  - `Content-Type: application/json`

### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :---: | :---: | :--- |
| `patient_request_id` | `string` | Sim | UUID da solicitação de paciente a ser analisada |

### Resposta (200 OK)

Retorna e salva na tabela `ai_triage_results` os dados processados pelo Gemini 2.5 Flash:

```json
{
  "success": true,
  "data": {
    "id": "e93f9c6d-3cd7-4632-9cb1-efad41db21ba",
    "patient_request_id": "8c339798-2eb1-46bb-88b1-12c8ff46c071",
    "urgency_level": "high",
    "urgency_reason": "Paciente necessita do prontuário para dar andamento urgente a tratamento oncológico de quimioterapia na próxima semana.",
    "summary": "Solicitação de cópia de prontuário para quimioterapia em outra clínica.",
    "inconsistencies": [],
    "prontuario_notes": "Atenção: Priorizar a digitalização da ala de oncologia dos últimos 6 meses.",
    "created_at": "2026-06-16T10:45:00Z"
  }
}
```

---

## 6. `ai-audit-checklist`

**Feature de IA:** Analisa os metadados e o histórico de versões de um prontuário recém-uploadado e aponta possíveis anomalias físicas (ex.: arquivos muito pequenos, perda brusca de tamanho entre versões, poucas páginas declaradas).

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/ai-audit-checklist`
- **Headers:**
  - `Content-Type: application/json`

### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :---: | :---: | :--- |
| `prontuario_id` | `string` | Sim | UUID do prontuário no banco de dados |

### Resposta (200 OK)

```json
{
  "success": true,
  "alerts": [
    {
      "severity": "medium",
      "message": "Prontuário possui apenas 1 página cadastrada para o tipo 'Prontuário Médico Completo', o que é incomum."
    },
    {
      "severity": "high",
      "message": "Houve reenvio de arquivo em menos de 5 minutos, sugerindo correção manual apressada ou erro de upload."
    }
  ]
}
```

Se nenhuma inconformidade for achada, `alerts` retorna vazio: `[]`.

---

## 7. `ai-whatsapp-message`

**Feature de IA:** Redige de forma inteligente uma mensagem amigável, clara e profissional para ser enviada ao paciente via WhatsApp caso o revisor precise solicitar ajustes na documentação.

- **Método:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/ai-whatsapp-message`
- **Headers:**
  - `Content-Type: application/json`

### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :---: | :---: | :--- |
| `patient_request_id` | `string` | Sim | ID da solicitação do paciente |
| `context` | `string` | Sim | Instruções curtas do revisor sobre o problema (ex: 'PDF enviado veio sem assinatura digital') |

### Resposta (200 OK)

```json
{
  "success": true,
  "message": "Olá Carlos Eduardo Souza! Analisamos sua solicitação de cópia de prontuário (Token: ABCD1234). Vimos que o PDF enviado veio sem a assinatura física ou digital necessária. Por favor, assine o documento e faça o envio novamente pelo link para darmos andamento ao seu pedido. Qualquer dúvida, estamos à disposição!"
}
```

---

## Códigos de Erro Padrão

- **`400 Bad Request`**: Parâmetros obrigatórios ausentes ou de tipo inválido.
- **`401 Unauthorized`**: Token de autenticação ausente ou inválido (para funções restritas a admins).
- **`403 Forbidden`**: Usuário autenticado mas sem o papel (`role`) necessário para a operação.
- **`404 Not Found`**: Registro informado (ID de prontuário ou solicitação) não foi localizado no banco.
- **`422 Unprocessable Entity`**: Transição de status não permitida pelo fluxo definido de regras de negócio.
- **`500 Internal Server Error`**: Erros de infraestrutura, indisponibilidade do banco de dados ou ausência de chaves de API cruciais (`GEMINI_API_KEY`, etc.) nos secrets do Supabase.

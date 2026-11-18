-- Nome completo (spec 023): o "nome de exibição" passa a ser o nome completo da conta.
-- A regra "nome e sobrenome" fica só no form de cadastro: contas antigas de uma palavra continuam válidas.
ALTER TABLE users DROP CONSTRAINT users_display_name_check;
ALTER TABLE users ADD CONSTRAINT users_display_name_check
  CHECK (char_length(display_name) BETWEEN 2 AND 80);

-- Apelido opcional: NULL = usar o nome completo da conta (resolvido na leitura).
ALTER TABLE memberships ALTER COLUMN nickname DROP NOT NULL;

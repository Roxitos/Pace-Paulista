-- Mapa real (spec 024): ponto de encontro em graus decimais (WGS 84). NULL = grupo sem ponto no mapa.
ALTER TABLE groups
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION,
  -- Os dois juntos ou nenhum.
  ADD CONSTRAINT groups_lat_lng_pair_check CHECK ((lat IS NULL) = (lng IS NULL)),
  -- Caixa do município de São Paulo, com folga: pega lat/lng trocados e sinal esquecido.
  ADD CONSTRAINT groups_lat_lng_sp_check CHECK (
    lat IS NULL OR (lat BETWEEN -24.05 AND -23.30 AND lng BETWEEN -46.85 AND -46.35)
  );

-- Grupos demo já gravados em produção (o seed é ON CONFLICT DO NOTHING e não os atualiza).
-- Num banco novo, nada casa aqui: o seed insere os demos já com lat/lng.
UPDATE groups AS g SET lat = v.lat, lng = v.lng
FROM (VALUES
  ('correria-do-carmo',   -23.5790, -46.4740),
  ('tiete-em-movimento',  -23.4890, -46.5190),
  ('pelotao-paulista',    -23.5614, -46.6559),
  ('minhocao-noturno',    -23.5374, -46.6527),
  ('pace-da-oca',         -23.5858, -46.6556),
  ('primeiro-km-ibira',   -23.5880, -46.6620),
  ('represa-run-club',    -23.7100, -46.7260),
  ('villa-lobos-runners', -23.5466, -46.7238),
  ('raia-usp',            -23.5565, -46.7210),
  ('cantareira-trail',    -23.4600, -46.6355),
  ('juventude-em-pace',   -23.5051, -46.6248)
) AS v(slug, lat, lng)
WHERE g.slug = v.slug AND g.is_demo AND g.lat IS NULL;

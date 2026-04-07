WITH ranked_servers AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'), LOWER(BTRIM(name))
      ORDER BY
        approved DESC,
        CASE status WHEN 'online' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END DESC,
        last_checked DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'), LOWER(BTRIM(name))
      ORDER BY
        approved DESC,
        CASE status WHEN 'online' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END DESC,
        last_checked DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS row_rank
  FROM mcp_servers
  WHERE COALESCE(NULLIF(BTRIM(name), ''), '') <> ''
), duplicate_servers AS (
  SELECT id, keep_id
  FROM ranked_servers
  WHERE row_rank > 1
)
UPDATE mcp_server_agents AS msa
SET mcp_server_id = ds.keep_id
FROM duplicate_servers AS ds
WHERE msa.mcp_server_id = ds.id
  AND ds.keep_id <> ds.id;

WITH ranked_servers AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'), LOWER(BTRIM(name))
      ORDER BY
        approved DESC,
        CASE status WHEN 'online' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END DESC,
        last_checked DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'), LOWER(BTRIM(name))
      ORDER BY
        approved DESC,
        CASE status WHEN 'online' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END DESC,
        last_checked DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS row_rank
  FROM mcp_servers
  WHERE COALESCE(NULLIF(BTRIM(name), ''), '') <> ''
), duplicate_servers AS (
  SELECT id, keep_id
  FROM ranked_servers
  WHERE row_rank > 1
)
UPDATE mcp_proxy_logs AS mpl
SET server_id = ds.keep_id
FROM duplicate_servers AS ds
WHERE mpl.server_id = ds.id
  AND ds.keep_id <> ds.id;

WITH ranked_servers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'), LOWER(BTRIM(name))
      ORDER BY
        approved DESC,
        CASE status WHEN 'online' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END DESC,
        last_checked DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS row_rank
  FROM mcp_servers
  WHERE COALESCE(NULLIF(BTRIM(name), ''), '') <> ''
)
DELETE FROM mcp_servers AS ms
USING ranked_servers AS rs
WHERE ms.id = rs.id
  AND rs.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_servers_tenant_name_unique
ON mcp_servers (
  COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default'),
  LOWER(BTRIM(name))
)
WHERE COALESCE(NULLIF(BTRIM(name), ''), '') <> '';
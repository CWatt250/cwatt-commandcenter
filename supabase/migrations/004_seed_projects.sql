-- Migration 004 — Seed Initial Projects
-- Run manually after initial setup, not part of automated migration flow.

insert into projects (name, slug, description, repo_url, repo_name, color, icon, sort_order) values
  ('BidWatt',       'bidwatt',       'Full-stack bid management app for Irex Argus',           'https://github.com/CWatt250/cwatt-bidboard',     'cwatt-bidboard',     '#F59E0B', '⚡',  0),
  ('ReserveStack',  'reservestack',  'HOA/condo reserve study compliance SaaS for Washington', 'https://github.com/CWatt250/reservestack',       'reservestack',       '#3B82F6', '🏢',  1),
  ('SubWatt',       'subwatt',       'HFIAW jurisdiction map and travel rate estimator PWA',   'https://github.com/CWatt250/subwatt',            'subwatt',            '#10B981', '🗺️',  2),
  ('CommandCenter', 'commandcenter', 'This app — Cwatt-CommandCenter itself',                  'https://github.com/CWatt250/cwatt-commandcenter','cwatt-commandcenter','#A855F7', '🎯',  3);

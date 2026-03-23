-- Add dish_family and allow recipe title updates via PATCH

alter table public.recipes
  add column if not exists dish_family text;

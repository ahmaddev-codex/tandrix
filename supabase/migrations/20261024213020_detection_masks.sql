-- Highlights (T12): SAM masks are stored as an SVG outline with their raster size, not as a
-- storage object, so a highlight is one row the phone can draw without another download.
alter table public.detections drop column mask_key;
alter table public.detections
  add column mask jsonb check (
    mask is null or (
      jsonb_typeof(mask -> 'path') = 'string'
      and octet_length(mask ->> 'path') <= 500000
      and (mask -> 'raster' ->> 'width')::int between 1 and 20000
      and (mask -> 'raster' ->> 'height')::int between 1 and 20000
    )
  );
-- "It's a different part" relabels the detection and counts as the user confirming it.
alter table public.detections
  add constraint detections_correction_confirmed
  check (corrected_label is null or confirmed_by_user is true);

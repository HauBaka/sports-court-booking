-- hệ số hợp lệ
insert into pricing_rules(name, rule_type, multiplier, applies_to_facility_id, start_time, end_time)
values ('Giờ vàng test', 'PEAK_HOUR', 1.30, 1, '08:00:00', '10:00:00');
-- kỳ vọng: ok

-- Hệ số vượt tràn (2.00)
insert into pricing_rules(name, rule_type, multiplier, applies_to_facility_id, start_time, end_time)
values ('Giờ vàng quá cao', 'PEAK_HOUR', 2.00, 1, '08:00:00', '10:00:00');
-- Kỳ vọng: error [3819] check constraint 'chk_pricing_multiplier' is violated

-- Hệ số dưới sàn (1.10)
insert into pricing_rules(name, rule_type, multiplier, applies_to_facility_id, start_time, end_time)
values ('Giờ vàng quá thấp', 'PEAK_HOUR', 1.10, 1, '08:00:00', '10:00:00');
-- Kỳ vọng: error [3819] check constraint 'chk_pricing_multiplier' is violated

-- Check chk_pricing_rules_shape
-- PEAK_HOUR thiếu start_time/end_time 
insert into pricing_rules(name, rule_type, multiplier, day_of_week)
values ('PEAK_HOUR sai', 'PEAK_HOUR', 1.30, 6);
-- Kỳ vọng: error [3819] check constraint 'chk_pricing_rule_shape' is violated

insert into pricing_rules(name, rule_type, multiplier, day_of_week, start_time, end_time)
values ('WEEKEND sai', 'WEEKEND', 1.30, 6, '08:00:00', '10:00:00');
-- Kỳ vọng: error [3819] check constraint 'chk_pricing_rule_shape'

-- check chk_courts_times (open_time >= close_time)
-- open_time sau closes_time lỗi
insert into courts(facility_id, sport_id, name, environment, open_time, close_time)
values(1, 1, 'Sân giờ ngược', 'INDOOR', '23:00:00', '06:00:00');
-- Kỳ vọng: error [3819] check constraint 'chk_courts_times'
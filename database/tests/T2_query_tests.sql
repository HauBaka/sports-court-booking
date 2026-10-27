-- Q1: lọc cơ sở theo city
select * from facilities
where city = 'TP.HCM' and is_active = true;

-- Q2: lọc cơ sở theo sport_id
select distinct f.*
from facilities f
join courts c on c.facility_id = f.id
where c.sport_id = 1
and f.is_active = true 
and c.is_active = true;

-- Q3: tìm theo tên (LIKE)
select * 
from facilities
where name like '%Kỳ Hòa' and is_active = true;

-- Q4: Danh sách sân theo cơ sở
select * from courts
where facility_id = 1 and is_active = true;

-- Q5: Tính min_price / max_price của từng cơ sở
select f.id, f.name, min(cs.base_price) as min_price, max(cs.base_price) as max_price
from facilities f
join courts c on c.facility_id = f.id
join court_slots cs on cs.court_id = c.id
where f.is_active = true
and c.is_active = true and cs.is_active = true
group by f.id, f.name;

-- Chạy explain
-- Q1:
EXPLAIN SELECT * FROM facilities WHERE city = 'TP.HCM' AND is_active = true;

-- Q2:
EXPLAIN SELECT DISTINCT f.* FROM facilities f JOIN courts c ON c.facility_id = f.id
WHERE c.sport_id = 1 AND f.is_active = true AND c.is_active = true;

-- Q3:
EXPLAIN SELECT * FROM facilities
WHERE name LIKE '%Kỳ Hòa' AND is_active = true;

-- Q4:
EXPLAIN SELECT * FROM courts
WHERE facility_id = 1 AND is_active = true;

-- Q5:
EXPLAIN SELECT f.id, f.name, MIN(cs.base_price) AS min_price, MAX(cs.base_price) AS max_price
FROM facilities f
JOIN courts c ON c.facility_id = f.id
JOIN court_slots cs ON cs.court_id = c.id
WHERE f.is_active = true
  AND c.is_active = true
  AND cs.is_active = true
GROUP BY f.id, f.name;

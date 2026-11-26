-- hợp lệ
insert into team_posts(user_id, booking_id, title, players_needed) values (6, 1, 'Tìm 2 bạn đánh đôi', 2);
-- kỳ vọng: ok
-- biến: players_needed = 0
insert into team_posts(user_id, booking_id, title, players_needed) values (6, 1, 'Sai', 0);
-- kỳ vọng: error [4025] constraint 'chk_tp_players' failed
-- status sai
insert into team_posts(user_id, booking_id, title, players_needed, status) values (6,1, 'Sai', 1, 'DONE');
-- kỳ vọng: error [1265] Data truncated for column 'status'
-- application status sai
insert into team_post_applications(post_id, user_id, status) values (1, 5, 'DONE');
-- kỳ vọng: error [1265] Data truncated for column 'status'
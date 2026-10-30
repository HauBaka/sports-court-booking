#!/bin/bash
# Chạy tự động trong container CSDL test (docker-compose.test.yml) khi tạo database lần đầu.
# Nạp migrations rồi seeds theo thứ tự tên file. Migration dùng DELIMITER nên phải qua CLI.
set -e
for f in /sql/migrations/*.sql /sql/seeds/*.sql; do
  echo "Nạp $f"
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$f"
done

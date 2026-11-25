"""Kịch bản ghép đội 6.1 đến 6.5 (docs/test-scenarios.md mục 7). Chạy trên CSDL vừa nạp seed S2, S3.
Mỗi ca dùng một khung giờ riêng của ngày U. Chạy lại phải nạp lại seed."""
from .helpers import (
    API, CUSTOMER_A, CUSTOMER_B, auth, book, day_u, deposit, new_customer, scalar, wait_for,
)

U = day_u()
CUSTOMER_B_ID = 6


def create_post(client, headers, booking_id, players_needed=2):
    return client.post(f"{API}/team-posts", headers=headers, json={
        "booking_id": booking_id, "title": "Tìm bạn đánh đôi", "players_needed": players_needed,
    })


def apply(client, headers, post_id):
    return client.post(f"{API}/team-posts/{post_id}/applications", headers=headers, json={"message": "Xin tham gia"})


def applications(client, headers, post_id):
    return client.get(f"{API}/team-posts/{post_id}/applications", headers=headers)


def posts(client, status):
    return client.get(f"{API}/team-posts", params={"status": status, "limit": 100}).json()["data"]


def poster(client, prefix, hour, players_needed=2):
    """Khách mới đặt sân 1 ngày U, cọc, rồi tạo bài."""
    headers = auth(client, new_customer(client, 100000, prefix))
    booking_id = book(client, headers, 1, U, [hour]).json()["data"]["booking_id"]
    assert deposit(client, headers, booking_id).status_code == 200
    res = create_post(client, headers, booking_id, players_needed)
    assert res.status_code == 201
    return headers, booking_id, res.json()["data"]["id"]


def error_code(res):
    return res.json()["error"]["code"]


def application_status(app_id):
    return scalar("SELECT status FROM team_post_applications WHERE id = :a", a=app_id)


@wait_for("SCB-209")
def test_ghep_01_tao_bai_tu_don_da_coc(client):
    _, _, post_id = poster(client, "ghep01", 9)
    assert scalar("SELECT status FROM team_posts WHERE id = :p", p=post_id) == "OPEN"
    assert post_id in [p["id"] for p in posts(client, "OPEN")]


@wait_for("SCB-209")
def test_ghep_02_tao_bai_tu_don_chua_coc(client):
    a = auth(client, CUSTOMER_A)
    booking_id = book(client, a, 1, U, [10]).json()["data"]["booking_id"]
    res = create_post(client, a, booking_id)
    assert res.status_code == 400
    assert error_code(res) == "BOOKING_NOT_DEPOSITED"
    assert scalar("SELECT COUNT(*) FROM team_posts WHERE booking_id = :b", b=booking_id) == 0


@wait_for("SCB-209")
def test_ghep_03_tao_bai_tu_don_nguoi_khac(client):
    res = create_post(client, auth(client, CUSTOMER_A), 1)
    assert res.status_code == 403
    assert error_code(res) == "AUTH_FORBIDDEN"
    assert scalar("SELECT COUNT(*) FROM team_posts WHERE booking_id = 1 AND user_id <> :b", b=CUSTOMER_B_ID) == 0


@wait_for("SCB-209")
def test_ghep_04_ung_tuyen_va_xem_ung_vien(client):
    headers, _, post_id = poster(client, "ghep04", 11)
    res = apply(client, auth(client, CUSTOMER_B), post_id)
    assert res.status_code == 201
    assert res.json()["data"]["status"] == "PENDING"
    listed = applications(client, headers, post_id)
    assert listed.status_code == 200
    assert CUSTOMER_B_ID in [a["user_id"] for a in listed.json()["data"]]


@wait_for("SCB-209")
def test_ghep_05_tu_ung_tuyen(client):
    headers, _, post_id = poster(client, "ghep05", 12)
    res = apply(client, headers, post_id)
    assert res.status_code == 400
    assert error_code(res) == "CANNOT_APPLY_OWN_POST"


@wait_for("SCB-209")
def test_ghep_06_ung_tuyen_trung(client):
    _, _, post_id = poster(client, "ghep06", 13)
    b = auth(client, CUSTOMER_B)
    assert apply(client, b, post_id).status_code == 201
    res = apply(client, b, post_id)
    assert res.status_code == 409
    assert error_code(res) == "APPLICATION_ALREADY_EXISTS"
    assert scalar("SELECT COUNT(*) FROM team_post_applications WHERE post_id = :p", p=post_id) == 1


@wait_for("SCB-209")
def test_ghep_07_duyet_du_nguoi_thi_dong_bai(client):
    headers, _, post_id = poster(client, "ghep07", 14, players_needed=1)
    app_id = apply(client, auth(client, CUSTOMER_B), post_id).json()["data"]["id"]
    res = client.patch(f"{API}/team-posts/{post_id}/applications/{app_id}", headers=headers, json={"status": "ACCEPTED"})
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "ACCEPTED"
    assert scalar("SELECT status FROM team_posts WHERE id = :p", p=post_id) == "CLOSED"
    late = apply(client, auth(client, CUSTOMER_A), post_id)
    assert late.status_code == 400
    assert error_code(late) == "TEAM_POST_CLOSED"


@wait_for("SCB-209")
def test_ghep_08_nguoi_khac_duyet_hoac_xem_ung_vien(client):
    _, _, post_id = poster(client, "ghep08", 15)
    app_id = apply(client, auth(client, CUSTOMER_B), post_id).json()["data"]["id"]
    a = auth(client, CUSTOMER_A)
    res = client.patch(f"{API}/team-posts/{post_id}/applications/{app_id}", headers=a, json={"status": "ACCEPTED"})
    assert res.status_code == 403
    assert error_code(res) == "AUTH_FORBIDDEN"
    res = applications(client, a, post_id)
    assert res.status_code == 403
    assert error_code(res) == "AUTH_FORBIDDEN"
    assert application_status(app_id) == "PENDING"


@wait_for("SCB-204", "SCB-209", "SCB-212")
def test_ghep_09_huy_don_thi_dong_bai(client):
    headers, booking_id, post_id = poster(client, "ghep09", 16)
    app_id = apply(client, auth(client, CUSTOMER_B), post_id).json()["data"]["id"]
    res = client.post(f"{API}/bookings/{booking_id}/cancel", headers=headers, json={"cancel_reason": "Bận việc"})
    assert res.status_code == 200
    assert post_id in [p["id"] for p in posts(client, "CANCELLED")]
    assert application_status(app_id) == "REJECTED"

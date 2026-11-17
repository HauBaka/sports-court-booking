// Dữ liệu mẫu cho bản giao diện. Mọi ngày tháng tính từ hôm nay để lịch luôn "sống".
import { dateKey, addDays } from "../lib/format";

const IMG = "../assets/img/";
export const PHOTOS = {
  futsalNight: IMG + "photo-f141382632-960.jpg",
  pickleDoubles: IMG + "photo-f65975778-960.jpg",
  racket: IMG + "photo-f69770121-500.jpg",
  indoorPickle: IMG + "photo-f65975778-500.jpg",
  picklePros: IMG + "photo-f65975778-500.jpg",
  badmintonHall: IMG + "photo-f47425568-960.jpg",
  futsalDay: IMG + "photo-f77025547-960.jpg",
  shuttle: IMG + "photo-f92863522-500.jpg",
};

export const SPORTS = [
  { id: "badminton", name: "Cầu lông" },
  { id: "pickleball", name: "Pickleball" },
  { id: "football", name: "Bóng đá mini" },
];
export const sportName = (id) => SPORTS.find((s) => s.id === id)?.name ?? id;

export const CITIES = {
  "TP.HCM": ["Tân Bình", "Quận 3", "Quận 10", "Phú Nhuận", "Gò Vấp", "Thủ Đức", "Bình Thạnh"],
  "Hà Nội": ["Cầu Giấy", "Đống Đa", "Thanh Xuân"],
  "Đà Nẵng": ["Hải Châu", "Sơn Trà"],
};

export const AMENITIES = ["Bãi đỗ xe", "Phòng thay đồ", "Nước uống", "Đèn chiếu sáng", "Wifi", "Mái che", "Căng tin"];

const court = (id, name, sport, price, extra = {}) => ({ id, name, sport, price, indoor: true, type: "Thảm PVC", open: "06:00", close: "22:00", active: true, ...extra });

export const FACILITIES = [
  {
    id: "thanh-cong", ownerId: "u-owner", name: "Cầu lông Thành Công", sports: ["badminton"],
    street: "Cộng Hòa", district: "Tân Bình", city: "TP.HCM", open: "06:00", close: "22:00",
    photos: [PHOTOS.badmintonHall, PHOTOS.racket, PHOTOS.shuttle], map: { x: 42, y: 38 },
    rating: 4.8, reviews: 126, amenities: ["Bãi đỗ xe", "Phòng thay đồ", "Nước uống", "Đèn chiếu sáng"],
    description: "Nhà thi đấu 4 sân cầu lông thảm PVC, trần cao 9 m, đèn LED không chói. Gần sân bay, có chỗ để ô tô.",
    courts: [court("tc-1", "Sân 1", "badminton", 120000), court("tc-2", "Sân 2", "badminton", 120000), court("tc-3", "Sân 3", "badminton", 100000), court("tc-4", "Sân 4", "badminton", 100000, { active: false })],
    services: [
      { id: "s1", name: "Thuê vợt", unit: "cây", price: 20000, active: true },
      { id: "s2", name: "Nước suối", unit: "chai", price: 10000, active: true },
      { id: "s3", name: "Cầu Yonex", unit: "quả", price: 25000, active: true },
      { id: "s4", name: "Khăn lạnh", unit: "cái", price: 5000, active: false },
    ],
    rules: [
      { id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.3 },
      { id: "r2", type: "WEEKEND", label: "Cuối tuần", multiplier: 1.2 },
      { id: "r3", type: "HOLIDAY", label: "Ngày lễ", multiplier: 1.5 },
    ],
  },
  {
    id: "bau-cat", ownerId: "u-owner", name: "Pickleball Bàu Cát", sports: ["pickleball"],
    street: "Bàu Cát", district: "Tân Bình", city: "TP.HCM", open: "05:30", close: "22:00",
    photos: [PHOTOS.pickleDoubles, PHOTOS.badmintonHall], map: { x: 30, y: 52 },
    rating: 4.6, reviews: 58, amenities: ["Bãi đỗ xe", "Nước uống", "Mái che", "Wifi"],
    description: "3 sân pickleball tiêu chuẩn có mái che, mặt sân acrylic. Có cho thuê vợt và bóng.",
    courts: [court("bc-1", "Sân A", "pickleball", 150000, { type: "Acrylic" }), court("bc-2", "Sân B", "pickleball", 150000, { type: "Acrylic" }), court("bc-3", "Sân C", "pickleball", 130000, { type: "Acrylic", indoor: false })],
    services: [
      { id: "s1", name: "Thuê vợt pickleball", unit: "cây", price: 30000, active: true },
      { id: "s2", name: "Bóng", unit: "quả", price: 15000, active: true },
    ],
    rules: [{ id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "21:00", multiplier: 1.4 }, { id: "r2", type: "WEEKEND", label: "Cuối tuần", multiplier: 1.2 }],
  },
  {
    id: "phu-tho", ownerId: "u-owner", name: "Sân bóng Phú Thọ", sports: ["football"],
    street: "Lữ Gia", district: "Quận 10", city: "TP.HCM", open: "06:00", close: "23:00",
    photos: [PHOTOS.futsalNight, PHOTOS.futsalDay], map: { x: 58, y: 62 },
    rating: 4.5, reviews: 211, amenities: ["Bãi đỗ xe", "Phòng thay đồ", "Đèn chiếu sáng", "Căng tin"],
    description: "2 sân 5 người và 1 sân 7 người cỏ nhân tạo, đèn pha đủ sáng cho trận buổi tối.",
    courts: [court("pt-1", "Sân 5A", "football", 300000, { type: "Cỏ nhân tạo", indoor: false, close: "23:00" }), court("pt-2", "Sân 5B", "football", 300000, { type: "Cỏ nhân tạo", indoor: false, close: "23:00" }), court("pt-3", "Sân 7", "football", 450000, { type: "Cỏ nhân tạo", indoor: false, close: "23:00" })],
    services: [{ id: "s1", name: "Thuê áo bib", unit: "bộ", price: 50000, active: true }, { id: "s2", name: "Nước suối", unit: "thùng", price: 90000, active: true }],
    rules: [{ id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "18:00", to: "21:00", multiplier: 1.5 }, { id: "r2", type: "WEEKEND", label: "Cuối tuần", multiplier: 1.3 }],
  },
  {
    id: "hoang-long", ownerId: "u-owner2", name: "Hoàng Long Club", sports: ["badminton", "pickleball"],
    street: "Trường Chinh", district: "Tân Bình", city: "TP.HCM", open: "06:00", close: "22:00",
    photos: [PHOTOS.racket, PHOTOS.badmintonHall, PHOTOS.indoorPickle], map: { x: 22, y: 30 },
    rating: 4.7, reviews: 94, amenities: ["Bãi đỗ xe", "Phòng thay đồ", "Wifi", "Nước uống"],
    description: "4 sân cầu lông và 2 sân pickleball trong nhà, có điều hòa ở khu chờ.",
    courts: [court("hl-1", "Cầu lông 1", "badminton", 140000), court("hl-2", "Cầu lông 2", "badminton", 140000), court("hl-3", "Pickleball 1", "pickleball", 160000)],
    services: [{ id: "s1", name: "Thuê vợt", unit: "cây", price: 25000, active: true }],
    rules: [{ id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.2 }],
  },
  {
    id: "ky-hoa", ownerId: "u-owner2", name: "Cầu lông Kỳ Hòa", sports: ["badminton"],
    street: "Ba Tháng Hai", district: "Quận 10", city: "TP.HCM", open: "05:00", close: "22:00",
    photos: [PHOTOS.shuttle, PHOTOS.badmintonHall], map: { x: 66, y: 44 },
    rating: 4.4, reviews: 77, amenities: ["Nước uống", "Đèn chiếu sáng"],
    description: "5 sân cầu lông, mở cửa từ 5 giờ sáng cho nhóm chơi trước giờ làm.",
    courts: [court("kh-1", "Sân 1", "badminton", 130000), court("kh-2", "Sân 2", "badminton", 130000)],
    services: [{ id: "s1", name: "Nước suối", unit: "chai", price: 10000, active: true }],
    rules: [{ id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.3 }],
  },
  {
    id: "an-nhon", ownerId: "u-owner2", name: "Sân bóng An Nhơn", sports: ["football"],
    street: "Quang Trung", district: "Gò Vấp", city: "TP.HCM", open: "06:00", close: "23:00",
    photos: [PHOTOS.futsalDay, PHOTOS.futsalNight], map: { x: 48, y: 18 },
    rating: 4.2, reviews: 39, amenities: ["Bãi đỗ xe", "Căng tin"],
    description: "2 sân 5 người cỏ nhân tạo, giá mềm cho nhóm sinh viên buổi chiều.",
    courts: [court("an-1", "Sân 1", "football", 250000, { type: "Cỏ nhân tạo", indoor: false, close: "23:00" }), court("an-2", "Sân 2", "football", 250000, { type: "Cỏ nhân tạo", indoor: false, close: "23:00" })],
    services: [{ id: "s1", name: "Thuê áo bib", unit: "bộ", price: 40000, active: true }],
    rules: [{ id: "r1", type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.3 }],
  },
  {
    id: "thao-dien", ownerId: "u-owner2", name: "Pickleball Thảo Điền", sports: ["pickleball"],
    street: "Xuân Thủy", district: "Thủ Đức", city: "TP.HCM", open: "06:00", close: "21:00",
    photos: [PHOTOS.picklePros], map: { x: 82, y: 40 },
    rating: 4.9, reviews: 41, amenities: ["Bãi đỗ xe", "Wifi", "Căng tin", "Mái che"],
    description: "2 sân pickleball ngoài trời cạnh sông, mát vào buổi sáng sớm.",
    courts: [court("td-1", "Sân 1", "pickleball", 180000, { type: "Acrylic", indoor: false, close: "21:00" }), court("td-2", "Sân 2", "pickleball", 180000, { type: "Acrylic", indoor: false, close: "21:00" })],
    services: [{ id: "s1", name: "Thuê vợt pickleball", unit: "cây", price: 30000, active: true }],
    rules: [{ id: "r1", type: "WEEKEND", label: "Cuối tuần", multiplier: 1.3 }],
  },
  {
    id: "cau-giay", ownerId: "u-owner2", name: "Nhà thi đấu Cầu Giấy", sports: ["badminton"],
    street: "Trần Thái Tông", district: "Cầu Giấy", city: "Hà Nội", open: "06:00", close: "22:00",
    photos: [PHOTOS.badmintonHall, PHOTOS.shuttle], map: { x: 50, y: 50 },
    rating: 4.6, reviews: 63, amenities: ["Bãi đỗ xe", "Phòng thay đồ", "Nước uống"],
    description: "6 sân cầu lông trong nhà, sàn gỗ.", courts: [court("cg-1", "Sân 1", "badminton", 110000, { type: "Sàn gỗ" }), court("cg-2", "Sân 2", "badminton", 110000, { type: "Sàn gỗ" })],
    services: [], rules: [],
  },
];

export const USERS = [
  { id: "u-cus", name: "Nguyễn Minh", email: "minh@sanchung.example", phone: "0900000001", role: "customer", createdAt: "2026-09-02" },
  { id: "u-owner", name: "Hoàng Long", email: "long@sanchung.example", phone: "0900000002", role: "owner", createdAt: "2026-08-20" },
  { id: "u-owner2", name: "Trần Thu Hà", email: "ha@sanchung.example", phone: "0900000003", role: "owner", createdAt: "2026-08-28" },
  { id: "u-admin", name: "Quản trị viên", email: "admin@sanchung.example", phone: "0900000004", role: "admin", createdAt: "2026-08-01" },
  { id: "u-c2", name: "Lê Thu", email: "thu@sanchung.example", phone: "0900000005", role: "customer", createdAt: "2026-10-03" },
  { id: "u-c3", name: "Trần Hùng", email: "hung@sanchung.example", phone: "0900000006", role: "customer", createdAt: "2026-10-11" },
  { id: "u-c4", name: "Phạm An", email: "an@sanchung.example", phone: "0900000007", role: "customer", createdAt: "2026-10-19" },
  { id: "u-c5", name: "Võ Dũng", email: "dung@sanchung.example", phone: "0900000008", role: "customer", createdAt: "2026-11-01" },
  { id: "u-c6", name: "Hoàng Nam", email: "nam@sanchung.example", phone: "0900000009", role: "customer", createdAt: "2026-11-05" },
];

export const HOLIDAYS = [
  { id: "h1", name: "Tết Dương lịch", date: "2027-01-01", yearly: true },
  { id: "h2", name: "Tết Nguyên đán (mùng 1)", date: "2027-02-06", yearly: false },
  { id: "h3", name: "Giỗ Tổ Hùng Vương", date: "2027-04-16", yearly: false },
  { id: "h4", name: "Ngày Giải phóng miền Nam", date: "2027-04-30", yearly: true },
  { id: "h5", name: "Quốc tế Lao động", date: "2027-05-01", yearly: true },
  { id: "h6", name: "Quốc khánh", date: "2026-09-02", yearly: true },
];

const today = new Date();
const d = (n) => dateKey(addDays(today, n));

// Đơn mẫu. slots: giờ bắt đầu của từng khung 1 giờ.
export const BOOKINGS = [
  { id: "SC-24817", userId: "u-cus", facilityId: "thanh-cong", courtId: "tc-1", date: d(2), slots: ["19:00", "20:00"], services: [{ id: "s1", qty: 2 }], status: "DEPOSITED", createdAt: d(-1) },
  { id: "SC-24790", userId: "u-cus", facilityId: "bau-cat", courtId: "bc-2", date: d(0), slots: ["18:00"], services: [], status: "DEPOSITED", createdAt: d(-3) },
  { id: "SC-24755", userId: "u-cus", facilityId: "phu-tho", courtId: "pt-1", date: d(-4), slots: ["19:00", "20:00"], services: [{ id: "s1", qty: 1 }], status: "COMPLETED", createdAt: d(-8) },
  { id: "SC-24702", userId: "u-cus", facilityId: "thanh-cong", courtId: "tc-3", date: d(-9), slots: ["07:00"], services: [], status: "CANCELLED", createdAt: d(-12), refund: { pct: 80, amount: 24000 } },
  { id: "SC-24688", userId: "u-cus", facilityId: "hoang-long", courtId: "hl-1", date: d(-14), slots: ["18:00", "19:00"], services: [], status: "COMPLETED", createdAt: d(-16), reviewed: true },
  // đơn của khách khác tại cơ sở của chủ sân Hoàng Long
  { id: "SC-24820", userId: "u-c3", facilityId: "thanh-cong", courtId: "tc-1", date: d(0), slots: ["17:00"], services: [], status: "PENDING_DEPOSIT", createdAt: d(0) },
  { id: "SC-24812", userId: "u-c2", facilityId: "thanh-cong", courtId: "tc-2", date: d(0), slots: ["18:00"], services: [{ id: "s2", qty: 4 }], status: "DEPOSITED", createdAt: d(-2) },
  { id: "SC-24809", userId: "u-c6", facilityId: "thanh-cong", courtId: "tc-3", date: d(0), slots: ["21:00"], services: [], status: "DEPOSITED", createdAt: d(-2) },
  { id: "SC-24801", userId: "u-c5", facilityId: "thanh-cong", courtId: "tc-3", date: d(0), slots: ["19:00"], services: [], status: "CANCELLED", createdAt: d(-2) },
  { id: "SC-24798", userId: "u-c4", facilityId: "thanh-cong", courtId: "tc-2", date: d(0), slots: ["20:00"], services: [], status: "PENDING_DEPOSIT", createdAt: d(0) },
  { id: "SC-24770", userId: "u-c2", facilityId: "thanh-cong", courtId: "tc-1", date: d(-1), slots: ["18:00", "19:00"], services: [], status: "DEPOSITED", createdAt: d(-5) },
  { id: "SC-24766", userId: "u-c6", facilityId: "bau-cat", courtId: "bc-1", date: d(-1), slots: ["06:00"], services: [], status: "COMPLETED", createdAt: d(-6) },
];

export const TRANSACTIONS = [
  { id: "T-9012", userId: "u-cus", type: "DEPOSIT", amount: -94800, at: d(-1) + "T10:12", note: "Cọc đơn SC-24817" },
  { id: "T-9001", userId: "u-cus", type: "DEPOSIT", amount: -54000, at: d(-3) + "T08:40", note: "Cọc đơn SC-24790" },
  { id: "T-8960", userId: "u-cus", type: "REFUND", amount: 24000, at: d(-10) + "T19:02", note: "Hoàn 80% cọc đơn SC-24702" },
  { id: "T-8944", userId: "u-cus", type: "DEPOSIT", amount: -30000, at: d(-12) + "T07:15", note: "Cọc đơn SC-24702" },
  { id: "T-8931", userId: "u-cus", type: "DEPOSIT", amount: -195000, at: d(-8) + "T21:30", note: "Cọc đơn SC-24755" },
  { id: "T-8900", userId: "u-cus", type: "TOPUP", amount: 1000000, at: d(-20) + "T09:00", note: "Admin cấp tiền" },
  { id: "T-9015", userId: "u-owner", type: "SETTLE", amount: 144000, at: d(-1) + "T22:10", note: "Kết toán đơn SC-24770" },
  { id: "T-8999", userId: "u-owner", type: "FORFEIT", amount: 6000, at: d(-10) + "T19:02", note: "Phần cọc không hoàn đơn SC-24702" },
  { id: "T-8981", userId: "u-owner", type: "SETTLE", amount: 54000, at: d(-6) + "T07:30", note: "Kết toán đơn SC-24766" },
  { id: "T-8970", userId: "u-owner", type: "SETTLE", amount: 86400, at: d(-14) + "T21:00", note: "Kết toán đơn SC-24688" },
  { id: "T-8890", userId: "u-c2", type: "TOPUP", amount: 500000, at: d(-21) + "T09:05", note: "Admin cấp tiền" },
  { id: "T-8891", userId: "u-c3", type: "TOPUP", amount: 300000, at: d(-21) + "T09:06", note: "Admin cấp tiền" },
];

export const WALLETS = { "u-cus": 610200, "u-owner": 1290400, "u-owner2": 845000, "u-admin": 0, "u-c2": 356000, "u-c3": 300000, "u-c4": 120000, "u-c5": 48000, "u-c6": 210000, system: 1148000 };

export const REVIEWS = {
  "thanh-cong": [
    { by: "Lê Thu", stars: 5, at: d(-6), text: "Sân sạch, đèn không chói. Đặt 19:00 đến nơi là có sân ngay." },
    { by: "Nguyễn Minh", stars: 4, at: d(-15), text: "Giờ cao điểm hơi đông khu chờ, sân thì ổn." },
    { by: "Hoàng Nam", stars: 5, at: d(-22), text: "Chủ sân xác nhận hoàn tất nhanh, tiền cọc rõ ràng." },
  ],
};

export const TEAM_POSTS = [
  { id: "P-31", bookingId: "SC-24817", authorId: "u-cus", sport: "badminton", facilityId: "thanh-cong", date: d(2), time: "19:00–21:00", need: 2, level: "Trung bình", note: "Đánh đôi, cần thêm 2 người. Chia tiền sân sau buổi chơi.", applicants: [{ userId: "u-c4", status: "PENDING" }, { userId: "u-c6", status: "ACCEPTED" }] },
  { id: "P-29", bookingId: "x1", authorId: "u-c2", sport: "pickleball", facilityId: "bau-cat", date: d(1), time: "06:00–07:00", need: 1, level: "Mới chơi", note: "Nhóm mới tập, ai cũng được.", applicants: [] },
  { id: "P-27", bookingId: "x2", authorId: "u-c6", sport: "football", facilityId: "phu-tho", date: d(3), time: "20:00–21:00", need: 3, level: "Khá", note: "Thiếu 3 người sân 5, đá giao lưu.", applicants: [{ userId: "u-cus", status: "PENDING" }] },
  { id: "P-25", bookingId: "x3", authorId: "u-c3", sport: "badminton", facilityId: "ky-hoa", date: d(4), time: "05:00–06:00", need: 1, level: "Khá", note: "Đánh đơn buổi sáng sớm.", applicants: [] },
];

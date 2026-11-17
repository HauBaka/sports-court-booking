---
name: Sport Court Booking (SCB)
description: Đặt sân cầu lông, pickleball, bóng đá mini; lịch trống theo giờ, giá công khai, cọc 30% từ ví.
colors:
  court-green: "#1f6b3a"
  court-green-ink: "#ffffff"
  line-mint: "#bfe9c9"
  green-tint: "#e9f0eb"
  paper: "#f7f6f2"
  paper-deep: "#efede6"
  panel: "#ffffff"
  cell-free: "#f5f6f1"
  cell-taken: "#e7e9e1"
  ink: "#171916"
  muted: "#666862"
  night: "#141413"
  night-surface: "#1d1d1b"
  night-ink: "#f7f6f2"
  night-muted: "#9b9a95"
  warn: "#8a5300"
  warn-soft: "#fbf1dc"
  danger: "#b42318"
  danger-soft: "#fdecea"
  info: "#1f5a99"
  info-soft: "#e7eff9"
typography:
  display:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "clamp(38px, 3.24vw + 25.4px, 72px)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "clamp(30px, 1.72vw + 23.3px, 48px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body-lead:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.25
  label-mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\""
rounded:
  cell: "12px"
  sm: "10px"
  md: "16px"
  panel: "20px"
  lg: "24px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
  s-10: "128px"
components:
  button-primary:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.court-green-ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "20px 24px"
  slot-free:
    backgroundColor: "{colors.cell-free}"
    textColor: "{colors.muted}"
    rounded: "{rounded.cell}"
    height: "44px"
  slot-taken:
    backgroundColor: "{colors.cell-taken}"
    textColor: "{colors.muted}"
    rounded: "{rounded.cell}"
    height: "44px"
  slot-picked:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.court-green-ink}"
    rounded: "{rounded.cell}"
    height: "44px"
  status-free:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.court-green}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
  status-held:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.court-green-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
  status-full:
    backgroundColor: "#efefea"
    textColor: "#5c5e58"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
---

# Design System: Sport Court Booking (SCB)

## Overview

**Creative North Star: "The Court Board"**

Hệ giao diện là tấm bảng lịch treo ở quầy sân: mỗi hàng một sân con, mỗi cột một giờ, ô nào trống, ô nào đã cọc, ô nào đang có người giữ, nhìn một lần là biết. Mọi màn hình xoay quanh cái bảng đó và những con số đi kèm nó: tổng tiền, tiền cọc, mức hoàn. Trang trí chỉ được phép khi nó giúp đọc bảng nhanh hơn.

Nền là giấy ấm, gần trắng ngà; bảng và các khung nội dung là tấm trắng nổi nhẹ trên nền đó, bo tròn lớn, không viền cứng, đổ một bóng dài và thấp. Chỉ có một màu nhấn là xanh sân; nó đánh dấu thứ người chơi đã chọn hoặc đang giữ, và hành động chính. Độ dày nội dung vừa phải: khoảng thở rộng ở trang giới thiệu, gọn hơn trong app, nhưng cùng một bộ màu, bo góc và cách đổ bóng.

Cảm giác tay: mềm, gọn, chắc. Nút là viên thuốc, nhấn thì lún nhẹ; thẻ có liên kết nhấc lên 2px khi rê chuột; ô giờ đổi màu tức thì khi chọn. Trang giới thiệu (`site/`) là chuẩn của hệ này; app (`app/`) đã theo cùng chuẩn. Trên màn từ 1024×600 trở lên, mỗi trang của app đứng trọn trong màn hình: tiêu đề cố định, danh sách dài cuộn trong khung của nó.

**Key Characteristics:**
- Một màu nhấn xanh sân trên nền giấy ấm và tấm trắng.
- Lưới sân × giờ là thành phần trung tâm, các màn khác dẫn về nó.
- Bo tròn lớn, không viền cứng, bóng dài và thấp có chút xanh.
- Chữ không chân Mona Sans; số và nhãn kỹ thuật dùng Geist Mono.
- Một phần tối (night) duy nhất dành cho ví và tiền.

## Colors

Bảng màu tiết chế: giấy ấm, mực gần đen hơi xanh, một màu xanh sân làm điểm nhấn, một sắc bạc hà nhạt để tô chứ không để viết chữ.

### Primary
- **Court Green** (court-green): nút chính, ô giờ đã chọn, trạng thái "Đang giữ" của chính người dùng, chỉ số bước đang mở. Chữ trên nền này luôn trắng (court-green-ink).
- **Line Mint** (line-mint): vạch nhấn dưới từ khóa ở tiêu đề hero, nền đánh dấu, phần tô của thanh tiến độ. Không dùng làm màu chữ trên nền sáng.
- **Green Tint** (green-tint): nền nhạt cho nhãn "Còn trống", chip, ô đã cọc của mình; luôn đi với chữ Court Green.

### Neutral
- **Warm Paper** (paper): nền trang.
- **Deep Paper** (paper-deep): mặt phụ, dải nền xen kẽ.
- **White Panel** (panel): bảng, thẻ, cửa sổ app, câu hỏi đang mở.
- **Free Cell** (cell-free): ô giờ còn trống, nền ô tìm kiếm.
- **Taken Cell** (cell-taken): ô giờ đã cọc, đã khóa.
- **Court Ink** (ink): chữ chính.
- **Stone** (muted): chữ phụ, giờ, địa chỉ, ô trống.
- **Night** (night), **Night Surface** (night-surface), **Night Ink** (night-ink), **Night Muted** (night-muted): phần tối dành cho ví và dòng tiền.
- Đường kẻ: mực xanh đen ở độ trong 5–7% (`rgb(22 40 28 / 0.05)` đến `0.07`), không dùng xám thuần.

### Tertiary
- **Warn** (warn, warn-soft): đơn chờ đặt cọc, ô đang có người khác giữ trong app.
- **Danger** (danger, danger-soft): hủy, lỗi nhập, tiền bị mất.
- **Info** (info, info-soft): đơn đã hoàn tất.
Ba cặp này lấy từ app; trang giới thiệu chưa dùng.

### Named Rules
**The One Green Rule.** Xanh sân chỉ đánh dấu thứ thuộc về người đang xem (giờ họ chọn, chỗ họ giữ) và hành động chính. Không dùng làm nền trang trí hay viền khung.

**The Mint Is Not Ink Rule.** Line Mint là màu tô; chữ trên nền sáng không bao giờ dùng màu này.

## Typography

**Display Font:** Mona Sans (với system-ui), độ rộng 104%
**Body Font:** Mona Sans (với system-ui)
**Label/Mono Font:** Geist Mono (với ui-monospace)

**Character:** Một họ chữ không chân, rộng nhẹ, đậm vừa ở tiêu đề, chữ khít lại khi to. Geist Mono cho giờ, số tiền và chỉ số mục, để cột số thẳng hàng.

### Hierarchy
- **Display** (500, clamp 38–72px, 1.04, -0.04em): tiêu đề hero, mỗi trang một lần.
- **Headline** (500, clamp 30–48px, 1.1, -0.03em): tiêu đề mỗi section.
- **Title** (500, 24px, 1.25): tiêu đề thẻ, câu hỏi, tên bước.
- **Body lead** (400, 18px, 1.5): đoạn dẫn cạnh tiêu đề section, tối đa khoảng 60ch.
- **Body** (400, 16px, 1.55): văn bản thường.
- **UI** (500, 13px): chữ trong cửa sổ app, ô giờ, nhãn trạng thái.
- **Label mono** (400, 12px, số đều): giờ trên lưới, chỉ số "01 / 09", số thứ tự câu hỏi.

### Named Rules
**The Mono Numbers Rule.** Giờ, số tiền và chỉ số dùng Geist Mono số đều; chữ thường không bao giờ dùng mono.

**The Two Weights Rule.** Chỉ 400 và 500. Không in đậm 600–700 trong nội dung.

## Layout

Lưới 12 cột, khoảng cách cột 24px, nội dung nằm trong một `.wrap` với mép trái và mép phải bằng nhau. Thang khoảng cách 4–128px (s-1 đến s-10). Trên trang giới thiệu, mỗi section chiếm đúng một màn hình (một hoặc hai màn ở 1440×900), tiêu đề ở cột trái (5 cột), đoạn dẫn ở cột phải (6 cột, bắt đầu cột 7), nội dung chính phía dưới. Từ 1024px rộng và 640px cao, trang chuyển section theo từng bước cuộn. Dưới 1024px, các phần chia đôi xếp thành một cột, chữ trước hình; ở 390px nút giãn hết chiều ngang.

Lưới sân × giờ: cột nhãn sân cố định (44–88px), các cột giờ chia đều, khe 6px. Trên màn hẹp, lưới cuộn ngang và mép phải mờ dần để báo còn nội dung.

## Elevation & Depth

Chiều sâu đến từ tấm trắng nổi trên nền giấy, không từ viền. Bóng đổ dài, thấp, pha chút xanh mực (`rgb(22 40 28)`) thay vì đen thuần, kèm một vòng viền mờ 1px để giữ mép khi nền gần trắng.

### Shadow Vocabulary
- **Panel** (`0 0 0 1px rgb(22 40 28 / 0.045), 0 2px 4px -1px rgb(22 40 28 / 0.04), 0 14px 32px -12px rgb(22 40 28 / 0.1), 0 40px 72px -36px rgb(22 40 28 / 0.18)`): bảng, cửa sổ app, thẻ chính.
- **Panel small** (`0 0 0 1px rgb(22 40 28 / 0.05), 0 6px 18px -8px rgb(22 40 28 / 0.14)`): câu hỏi đang mở, thẻ nhỏ, ghi chú nổi.
- **Raised pill** (`0 0 0 1px rgb(22 40 28 / 0.04), 0 2px 6px -2px rgb(22 40 28 / 0.1)`): mục đang chọn trong thanh bên.
- **Green lift** (`0 6px 14px -6px` với xanh sân 70%): ô giờ đã chọn, nút chính.

### Named Rules
**The No Hard Border Rule.** Khung nội dung không có viền đặc; mép do bóng và vòng 1px rất mờ tạo ra.

## Shapes

Bo tròn lớn và nhất quán: ô giờ 12px, khung nhỏ 10–16px, bảng và cửa sổ app 20px, thẻ lớn 24px. Nút, chip, nhãn trạng thái, ô tìm kiếm là viên thuốc (999px). Đường kẻ giữa các hàng danh sách bắt đầu sau avatar, không chạy hết mép. Ô "đang giữ" dùng viền nét đứt 1.5px màu xanh sân.

## Components

### Buttons
- **Shape:** viên thuốc (999px), cao 44px (nhỏ 36px).
- **Primary:** nền xanh sân, chữ trắng 16px đậm 500, đệm ngang 24px, bóng xanh nhẹ.
- **Secondary:** nền trắng 70% trên giấy, vòng viền mờ 12%, chữ mực.
- **Hover / Active:** primary tối đi một chút; nhấn thì lún 1px và thu 0.985; mũi tên trong nút nhích sang phải khi rê chuột.
- **Focus:** viền 2px xanh sân, cách 2px.

### Chips / Status Pills
- **Style:** viên thuốc cao 24px, nền tô, không viền, chấm tròn 6px ở trước.
- **Trạng thái:** Còn trống: nền green-tint, chữ xanh sân. Đang giữ (của mình): nền xanh sân, chữ trắng. Kín lịch: nền xám rất nhạt, chữ xám đậm (đạt 5,7:1). Trong app còn có chờ cọc (warn), hoàn tất (info), đã hủy (xám).

### Cards / Containers
- **Corner Style:** 20px (bảng, cửa sổ), 24px (thẻ lớn).
- **Background:** trắng trên nền giấy.
- **Shadow Strategy:** Panel; thẻ có liên kết nhấc lên 2px khi rê chuột.
- **Border:** không; chỉ vòng 1px rất mờ trong bóng.
- **Internal Padding:** 20–24px.

### Inputs / Fields
- **Style:** cao 44–46px, nền trắng, vòng viền mờ, bo theo khung nhỏ; ô tìm kiếm là viên thuốc nền Free Cell.
- **Focus:** viền chuyển xanh sân và một quầng xanh 3px rất nhạt.
- **Error:** viền đỏ 2px, thông báo lỗi ngay dưới ô.

### Navigation
- Thanh trên cố định, nền giấy trong suốt có làm mờ phía sau. Logo bên trái, các mục ở giữa (14px, đậm 500), "Đăng nhập" và nút chính bên phải. Dưới 900px các mục gom vào menu toàn màn hình. Trang giới thiệu có thêm thanh chỉ mục dọc bên phải (đoạn ngang, tên section viết mono).

### Court Board (lưới sân × giờ)
Thành phần đặc trưng. Hàng là sân con, cột là giờ (nhãn giờ mono 12px). Ô cao 44px (52px trong app), bo 12px: trống = Free Cell chữ đá; đã cọc = Taken Cell; đang giữ = nền trong suốt, viền nét đứt xanh; đã chọn = nền xanh sân chữ trắng và bóng xanh. Dưới lưới là dòng tóm tắt (sân, giờ, tổng tiền mono) trên nền Free Cell bo 14px, với nút viên thuốc ở bên phải.

### App Window
Cửa sổ app vẽ lại trong trang giới thiệu: tấm trắng bo 20px, thanh trên không có dải nền, ba chấm nhạt; thanh bên nền gần trắng với mục đang chọn là viên thuốc nổi; hàng danh sách cao 56px với avatar tròn, tên, địa chỉ và nhãn trạng thái.

## Do's and Don'ts

### Do:
- **Do** để lưới sân × giờ là thứ nhìn thấy đầu tiên ở mọi màn liên quan đến đặt sân.
- **Do** dùng xanh sân (court-green) cho đúng thứ người dùng đã chọn, đang giữ, và hành động chính.
- **Do** viết giờ và tiền bằng Geist Mono số đều (ví dụ 19:00, 276.000đ).
- **Do** dùng bóng Panel thay cho viền để tách tấm trắng khỏi nền giấy.
- **Do** giữ bo tròn: 12px cho ô giờ, 20px cho bảng, 999px cho nút và nhãn.

### Don't:
- **Don't** dùng viền đặc 1px màu xám làm khung thẻ hay khung cửa sổ.
- **Don't** viết chữ màu Line Mint trên nền sáng.
- **Don't** thêm màu nhấn thứ hai; tím và tím nhạt không bao giờ xuất hiện.
- **Don't** dùng chữ đậm 600–700 trong nội dung.
- **Don't** để một trang app dài hơn màn hình từ 1024×600 trở lên; phần dài cuộn trong khung của nó.

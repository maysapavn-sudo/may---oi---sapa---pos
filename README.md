# MÂY POS – bản pilot hoàn chỉnh

## Cách chạy
1. Giải nén `MAY_POS_COMPLETE.zip`.
2. Mở `index.html` bằng Chrome/Edge.
3. PIN test cho tất cả vai trò: `1234`.

## Vai trò test
OWNER, QUẢN LÝ, THU NGÂN, PHỤC VỤ, BẾP, BAR, KHO/KẾ TOÁN.

## Luồng test nhanh
OWNER → Bán hàng → Bàn 01 → bấm Americano. Món phải hiện NGAY ở hóa đơn.
Bấm Americano thêm 2 lần → ×3 = 225.000đ.
Bấm − → ×2 = 150.000đ.
Chọn Món chính → Salmon Steak → gửi Bếp/Bar.
Mở Bếp/Bar để cập nhật MỚI → ĐANG LÀM → HOÀN THÀNH → ĐÃ PHỤC VỤ.
Thanh toán → bill khóa, bàn về trống, Dashboard tăng doanh thu.

## Phạm vi bản này
Đây là bản PILOT một máy, dữ liệu lưu bằng localStorage của trình duyệt.
Có backup/restore JSON, nhưng CHƯA phải production nhiều máy.

Trước khi dùng thu tiền thật cần:
- backend/database server;
- đăng nhập/mật khẩu thật và mã hóa;
- đồng bộ nhiều thiết bị;
- backup server tự động;
- khóa giao dịch ở server;
- phân quyền server-side;
- tích hợp máy in/QR thật;
- kiểm thử tải và bảo mật.

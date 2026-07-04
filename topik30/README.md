# Cấu trúc TOPIK 30 ngày (bản đã gộp, không dùng iframe)

**Trạng thái: đã xử lý xong đủ 30/30 ngày.**

## File trong thư mục này

| File | Vai trò |
|---|---|
| `t30-engine.js` | **Engine dùng chung** cho cả 30 ngày — chỉ nạp 1 lần trong `index.html`. Chứa toàn bộ hàm xử lý (switchTab, speakText, chấm điểm ôn tập, mindmap, nối thẻ...) bên trong 1 closure `window.t30`, không rò rỉ biến/hàm ra ngoài nên **không xung đột** với phần còn lại của web. |
| `t30-styles.css` | CSS riêng cho nội dung TOPIK 30 ngày, đã được gắn tiền tố `.t30-scope` cho mọi selector nên không đè lên CSS của các trang khác. |
| `dayNN.html` | **Fragment** — chỉ phần nội dung hiển thị (4 tab: Bảng kiểm tra / Học chi tiết / Từ dễ lẫn / Ôn tập), không có `<html>`, `<head>`, `<style>`, `<script>`. |
| `dayNN.data.json` | Dữ liệu riêng của ngày đó: `{ "vocabData": [...], "dict": {...} }`. |

## Vì sao không còn xung đột dữ liệu?

- `t30-engine.js` được xây dựng từ **day30.html** — phiên bản hoàn thiện nhất trong 30 file gốc bạn gửi (có đủ: nối thẻ, mindmap 4 tầng, tô sáng từ khóa trong câu ví dụ `highlightExampleText`, xử lý ẩn/hiện nghĩa qua `data-en-text`/`data-vi-text`...). Mình đã kiểm tra: các trường dữ liệu mới này đều là **optional**, nên dữ liệu của ngày 1-14 (đơn giản hơn) vẫn chạy tốt với engine này, chỉ là không có hiệu ứng tô sáng/nối thẻ nếu ngày đó vốn không có tính năng đó.
- Chỉ có **1 bản duy nhất** của mọi hàm/CSS (trong `t30-engine.js` / `t30-styles.css`), thay vì 30 bản trùng tên như trước.
- Khi bạn chuyển sang xem 1 ngày khác, `index.html` sẽ:
  1. `fetch()` file `dayNN.html` (fragment) + `dayNN.data.json`
  2. Render fragment vào `#topik30-day-root`
  3. Gọi `t30.mount(root, data)` → hàm này **reset toàn bộ trạng thái cũ** (đáp án đã chọn, ngôn ngữ dịch, thẻ đang nối...) rồi render dữ liệu mới vào
- Vì vậy dù 30 ngày dùng chung 1 bộ id (`check-tab`, `review-tab`...), tại 1 thời điểm chỉ có DOM của **đúng 1 ngày** tồn tại trong trang → không đụng độ.
- Tailwind CDN chỉ áp dụng style trong phạm vi `.t30-scope` (không nạp phần "preflight" reset mặc định của Tailwind) → không ảnh hưởng giao diện các trang khác của web.

## Nếu sau này bạn có thêm/sửa nội dung 1 ngày nào đó

Nếu bạn chỉnh sửa lại nội dung gốc 1 ngày (ví dụ thêm từ vựng, sửa câu ví dụ) và gửi lại file `dayNN.html` (định dạng gốc 1 file HTML đầy đủ như cũ), mình sẽ tách lại thành `dayNN.html` (fragment) + `dayNN.data.json` giống hệt quy trình đã làm.

Nếu muốn tự làm, cách tách thủ công 1 file gốc `dayNN.html`:
1. Phần trong `<body>`, từ `<div class="max-w-7xl...">` đến trước thẻ `<script>` đầu tiên → lưu thành `dayNN.html` (fragment). Đổi các `onclick="switchTab(...)"`, `onclick="speakText(...)"`... thành `onclick="t30.switchTab(...)"`, `onclick="t30.speakText(...)"` (thêm tiền tố `t30.`).
2. Phần `const vocabData = [...]` và `const EN_TO_VI_DICTIONARY = {...}` trong `<script>` → gộp thành `dayNN.data.json`:
   ```json
   { "day": NN, "vocabData": [...], "dict": {...} }
   ```
3. Phần còn lại của `<script>` (các hàm xử lý) **không cần copy** vì đã có sẵn trong `t30-engine.js` dùng chung.

## Lưu ý khi upload lên hosting

- Giữ nguyên cấu trúc thư mục: `index.html` cùng cấp với thư mục `topik30/`.
- `index.html` gọi `fetch('topik30/dayNN.html')` bằng đường dẫn tương đối, nên nếu đổi tên thư mục `topik30` thì phải sửa lại hằng số `TOPIK30_BASE_PATH` trong `index.html`.

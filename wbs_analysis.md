# WBS Analysis — "Seeky" (Swipe-based Job Matching App)

> Tài liệu phân tích nghiệp vụ (BA) dựa trên `wbs.csv`.
> Mục tiêu: (1) hiểu toàn cảnh sản phẩm, (2) chốt phạm vi **DEMO** mà ta sẽ build (BE NestJS + FE ReactJS), (3) đặc tả rõ phần **location / polygon / matching / swipe** vì đó là phần lõi kỹ thuật.

---

## 1. Tóm tắt sản phẩm

Seeky là một ứng dụng **mobile** (iOS/Android) tuyển dụng theo cơ chế **swipe** kiểu Tinder, kết nối **Employer** (nhà tuyển dụng) và **Candidate** (ứng viên). Thay vì CV truyền thống, mỗi bên tạo **Listing** kèm **video giới thiệu 30 giây**; người dùng vuốt qua các listing của phía còn lại để bày tỏ quan tâm.

Hai actor chính + 1 actor quản trị:

| Actor | Vai trò | Đặc điểm |
|---|---|---|
| **Employer** | Đăng tiêu chí tuyển dụng, vuốt qua ứng viên | Vuốt phải = mở khoá contact (yêu cầu **subscription**) + tự mở chat |
| **Candidate** | Đăng nguyện vọng làm việc + thông tin liên hệ | Vuốt phải = **miễn phí**, chỉ gửi notification cho Employer |
| **Admin** | Duyệt video, quản lý user/subscription/report | Web Admin Panel riêng (module 3.x) |

Một điểm cốt lõi về business model: **swipe là miễn phí**, doanh thu đến từ **Employer subscription** — chỉ khi Employer vuốt phải và muốn xem contact ứng viên thì mới bị gate bởi subscription.

---

## 2. Bản đồ module (theo WBS)

| ID | Module | Nội dung chính |
|---|---|---|
| **2.1** | Authentication & Registration | Welcome, Login, Logout, Reset/Change password, Đăng ký Employer & Candidate, Phone OTP, reCAPTCHA + WAF |
| **2.2** | Basic information set up | Onboarding mascot, Listing set up (Employer/Candidate), Camera recording, Video upload, AI script/teleprompter |
| **2.3** | Home screen | Màn hình chung 2 role, nội dung adapt theo role |
| **2.4** | **Swipe** | Employer swipe, Candidate swipe, **Matching priority**, **Map & Geolocation** (candidate region + employer location/radius) |
| **2.5** | Discussion page | Danh sách hội thoại, chat 1-1 (text/voice/video/file) |
| **2.6** | Profile & Account Settings | Profile, quản lý listing, drafts, favourites, subscription purchase, contact support |
| **2.7** | Notifications | Push/notification cho swipe, match, video validation… |
| **3.1–3.5** | Admin Panel | Auth admin, Users mgmt, **Video moderation thủ công**, Subscription mgmt, Report mgmt |

### 2.1 Các quy tắc nghiệp vụ đáng chú ý (để hiểu, không build hết trong demo)

- **Single-role rule**: mỗi email = đúng 1 tài khoản với đúng 1 role cố định. Đăng ký Candidate rồi thì không đăng ký Employer bằng email đó được (và ngược lại). Uniqueness kiểm tra **across all account types**.
- **Login không chọn role**: màn login giống nhau, role được resolve từ token sau khi xác thực.
- **Candidate phone gate (hard, server-side)**: nếu `phone_verified = false`, **mọi** protected endpoint trả `403` + redirect tới màn OTP. Đây là gate ở tầng API, không chỉ ở UI.
- **Progressive lockout**: 5 lần sai → khoá 15 phút; 10 lần sai → khoá 1 giờ + email cảnh báo. Login thành công hoặc reset pass → reset counter.
- **Password policy**: ≥ 8 ký tự, có chữ, số, ≥ 1 hoa, ≥ 1 ký tự đặc biệt.
- **OTP**: 6 số, hết hạn 10 phút, tối đa 3 lần resend/session (có quy tắc reset counter chi tiết).
- **Anti-bot**: reCAPTCHA v3 (score ≥ 0.5), fallback v2; + AWS WAF ở gateway. Chỉ áp dụng cho registration, **không** cho login.
- **Bảo mật**: HTTPS/TLS 1.2+ bắt buộc; reset link single-use, hết hạn 30 phút; thông điệp login/forgot password trung lập để chống account enumeration.

### 2.2 Listing & Video

- **Listing chỉ "active" trong feed khi**: (a) đủ field bắt buộc, **và** (b) có video **compliant đã được Admin duyệt thủ công** (3.3). Không có AI scan video ở MVP.
- Trạng thái listing: `Draft → Pending Review → Published / Rejected`. Lý do reject **không** tiết lộ cho user.
- Video: tối đa **30 giây**, MP4/MOV, có thể chọn 1 trong **10 background tĩnh** (person segmentation realtime; thiết bị không hỗ trợ thì ẩn lựa chọn). Có teleprompter + AI script (GPT-4.1 mini).
- Cả 2 role **không bắt buộc** có listing/video để được duyệt feed — vẫn có thể swipe.

### 2.4 Swipe & Matching (LÕI sản phẩm)

**Employer swipe** (xem Candidate listings):
- Card chỉ hiện video + thông tin cơ bản (field, contract, vùng chung, availability) — **tuyệt đối không hiện name/email/phone**.
- Swipe phải + **có** subscription → lộ contact (đã pre-consent ở 2.2.4) + auto tạo chat 1-1.
- Swipe phải + **không** subscription → chuyển tới màn mua subscription; mua xong quay lại lộ contact.
- Có thể chỉnh **radius** ngay trên màn swipe để đổi phạm vi địa lý.

**Candidate swipe** (xem Employer listings):
- Card hiện video + Company Name + Position + Location.
- Swipe phải **luôn miễn phí**, **không** mở chat, chỉ gửi interest + notification cho Employer; xuất hiện ở mục "Candidates interested in you" của Employer.

**Matching priority (2.4.3)** — rule-based (AI để Phase 2). Thứ tự ưu tiên:
1. **Location** (geolocation: employer company location + radius vs candidate desired region) ← *Priority 1*
2. **Industry / Sector** (field of activity)
3. **Availability** (start date vs availability)
4. **Gender, Age, Contract Type, Language** (4 yếu tố cùng 1 mức)
5. *Tie-breaker (chỉ feed Employer)*: candidate đã bày tỏ interest được xếp trên.
- Candidate **không** khai vùng làm việc → xếp **cuối** chứ không loại bỏ.
- Feed trả theo batch ~20, loại các card đã seen/swiped.
- Radius filter chỉ ảnh hưởng feed Employer, **không** ảnh hưởng feed Candidate.

### 2.4.4 / 2.4.5 — Map & Geolocation (phần quyết định kiến trúc location)

| | **Candidate — Preferred work region (2.4.4)** | **Employer — Location + radius (2.4.5)** |
|---|---|---|
| Bản chất | Một **thành phố / vùng** (region) | Một **điểm cụ thể** (company location) + bán kính |
| Nhập liệu | Text search + **autocomplete** (không cần map) | Autocomplete + **map pin** + slider radius |
| UI | Chỉ ô tìm kiếm + label | Map + pin + **radius circle** realtime |
| Radius | Không có | 5–200 km, bước 5 km, mặc định 50 km |
| Lưu ở | **Per listing** (mỗi listing 1 region) | **Per account preference** |
| Provider (WBS) | Autocomplete quốc tế | Google Maps Platform (Places + Maps SDK + Geocoding) |
| Vai trò matching | Priority 1 (vùng mong muốn) | Priority 1 (điểm + bán kính lọc feed) |

> **Khoảng trống cần làm rõ với Client**: WBS mô tả candidate region là "city/region" nhưng matching Priority 1 cần so khớp **hình học** giữa *điểm + bán kính của employer* và *vùng của candidate*. Điều này ngụ ý cần **polygon (ranh giới) của thành phố** để kiểm tra giao cắt với vòng tròn bán kính — đây chính là yêu cầu kỹ thuật mà bản demo này hiện thực hoá (xem §4).

---

## 3. Phạm vi DEMO (những gì ta thực sự build)

Theo yêu cầu: hiện thực hoá **lõi** nghiệp vụ bằng **web** (dù sản phẩm thật là mobile) để demo nhanh phần location/polygon/matching/swipe. Cắt bỏ các phần phụ trợ nặng (video, OTP, subscription, chat, admin, reCAPTCHA…) nhưng giữ đúng tinh thần nghiệp vụ.

### ✅ Có trong demo
1. **Tạo user đơn giản** với role như WBS: `EMPLOYER` / `CANDIDATE` (email + password + tên/công ty). Login trả token đơn giản.
2. **Tạo listing** theo role:
   - Employer: hiring position, field of activity, contract type, age range, **company location (điểm) + radius (km)**.
   - Candidate: headline, field, contract, age range, **preferred city (region)** + thông tin liên hệ + consent.
3. **Location autocomplete gọi từ BE** (BE proxy tới Geoapify) — FE không giữ API key.
   - Employer location: chọn **1 điểm cụ thể** + radius.
   - Candidate location: chọn **1 thành phố** (region).
4. **Lấy polygon của city** khi candidate tạo listing → lưu vào DB (Geoapify Place Details / Boundaries).
5. **Swipe feed dựa trên TẤT CẢ listing khả dụng của user**: tập tiêu chí của người vuốt = hợp của tất cả listing họ đang có; feed = listing phía đối diện **giao cắt hình học** với ít nhất một listing của họ. Ghi nhận swipe LEFT/RIGHT, loại card đã swipe.

### ❌ Ngoài phạm vi demo (chỉ mô tả trong tài liệu)
Video recording/upload/moderation, OTP/SMS, reCAPTCHA/WAF, subscription & payment, chat 1-1, notifications push, onboarding mascot, Admin Panel, lockout/i18n. Auth được làm tối giản (không JWT refresh/lockout).

---

## 4. Đặc tả kỹ thuật phần Location / Polygon / Matching (demo)

### 4.1 Mô hình dữ liệu

```
User { id, email, password, role(EMPLOYER|CANDIDATE), displayName, firstName?, lastName?, phone? }

Listing {
  id, ownerId, role,
  title, fieldOfActivity, contractType, ageMin, ageMax,
  // Employer
  point: { lat, lng }, radiusKm,
  // Candidate
  cityLabel, cityCenter: { lat, lng }, cityPolygon: GeoJSON(Polygon|MultiPolygon),
  contact: { firstName, lastName, email, phone }, consent: bool,
  status: ACTIVE
}

Swipe { id, swiperId, listingId, direction(LEFT|RIGHT), createdAt }
```

### 4.2 Geoapify (vì sao & dùng gì)

- **Autocomplete**: `GET /v1/geocode/autocomplete?text=...` → danh sách gợi ý (có `place_id`, `lat/lon`, loại địa điểm).
- **City polygon**: `GET /v2/place-details?id={place_id}&features=details` → trả `geometry` dạng Polygon/MultiPolygon (ranh giới hành chính của thành phố).
- BE đóng vai **proxy** (giữ API key ở server, đúng yêu cầu "autocomplete từ BE"), đồng thời chuẩn hoá output cho FE.
- **Fallback offline**: nếu không cấu hình `GEOAPIFY_API_KEY`, BE trả về một bộ dữ liệu mẫu (vài thành phố có sẵn polygon) để demo chạy được ngay, không phụ thuộc mạng/key.

### 4.3 Thuật toán matching (geometry)

Quy ước: một cặp (Employer listing E, Candidate listing C) **match** khi vòng tròn `circle(E.point, E.radiusKm)` **giao cắt** polygon vùng của candidate `C.cityPolygon`.

> Ý nghĩa nghiệp vụ: vùng ứng viên muốn làm việc nằm (một phần) trong phạm vi tuyển dụng của nhà tuyển dụng → đúng Priority 1 (Location) của 2.4.3.

Dùng `@turf/turf`:
```
match(E, C) = booleanIntersects( turf.circle(E.point, E.radiusKm, {units:'kilometers'}), C.cityPolygon )
```

**Feed cho người dùng U** (theo đúng yêu cầu "swipe dựa trên tất cả listing khả dụng của user"):
- Lấy `myListings` = tất cả listing ACTIVE của U.
- `targets` = tất cả listing ACTIVE của role đối diện, **chưa** bị U swipe.
- Một target T được đưa vào feed nếu **tồn tại** `m ∈ myListings` sao cho `match(employerSide, candidateSide)` đúng (tùy U là Employer hay Candidate mà gán vai E/C).
- Sắp xếp ưu tiên: (1) trùng `fieldOfActivity` lên trước (Priority 2), (2) còn lại theo geo. Loại card đã swipe.

Nếu U **chưa có** listing nào → không có tiêu chí → feed rỗng (đúng tinh thần "phải có thông tin thì matching mới chạy", 2.4.3).

### 4.4 API (demo)

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/auth/register` | Tạo user (role Employer/Candidate) |
| POST | `/auth/login` | Đăng nhập, trả token đơn giản |
| GET | `/auth/me` | Thông tin user hiện tại |
| GET | `/geo/autocomplete?text=` | Proxy Geoapify autocomplete |
| GET | `/geo/city-polygon?placeId=` | Lấy polygon city (Place Details) |
| POST | `/listings` | Tạo listing (candidate → fetch + lưu polygon) |
| GET | `/listings/mine` | Listing của tôi |
| GET | `/feed` | Feed swipe đã match (loại đã swipe) |
| POST | `/swipe` | Ghi nhận LEFT/RIGHT |

Auth tối giản: token = base64(userId); client gửi `Authorization: Bearer <token>`.

---

## 5. Rủi ro & câu hỏi mở (cho Client)

1. **Polygon của "region"**: thành phố có ranh giới rõ; nhưng "region/area" lớn (bang, vùng) thì polygon rất lớn → cần chốt mức granularity (city / admin level) để matching không quá rộng.
2. **Provider không đồng nhất**: WBS chốt Google cho Employer (2.4.5) nhưng candidate region (2.4.4) chỉ nói "autocomplete". Demo dùng **Geoapify cho cả hai** để 1 key chạy hết; production có thể tách provider.
3. **Lưu polygon**: polygon thành phố có thể vài chục–trăm KB. Production nên lưu PostGIS (`geometry`) + index GiST để intersect nhanh; demo lưu GeoJSON (JSON column) + tính bằng turf in-memory.
4. **Định nghĩa "match" chính xác**: intersect vòng tròn–polygon là cách diễn giải Priority 1; cần Client xác nhận (có thể họ muốn "tâm vùng nằm trong bán kính" thay vì "giao cắt").
5. **Radius lưu ở account vs listing**: WBS nói employer radius lưu ở account preference; demo lưu trên listing cho gọn — cần thống nhất khi lên production.

---

*Hết phần phân tích. Phần hiện thực: xem `backend/` (NestJS) và `frontend/` (React + Vite), hướng dẫn chạy ở `README.md`.*

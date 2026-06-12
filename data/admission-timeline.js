/**
 * Lịch tuyển sinh ĐH 2026 — theo thông báo Bộ GD&Đào tạo.
 * Cập nhật date/endDate khi có thông báo chính thức mới.
 */
export const ADMISSION_TIMELINE_YEAR = 2026;

export const ADMISSION_TIMELINE = [
  {
    id: 'practice-nv',
    step: 1,
    dateLabel: 'Từ ngày 17/6 đến 21/6/2026',
    description: 'Thí sinh THỰC HÀNH đăng ký, điều chỉnh nguyện vọng xét tuyển trên hệ thống.',
    highlight: 'THỰC HÀNH',
    date: '2026-06-17',
    endDate: '2026-06-21',
    icon: 'calendar',
    link: '#match',
  },
  {
    id: 'score-release',
    step: 2,
    dateLabel: '08h00 ngày 01/7/2026',
    description: 'Bộ GD&ĐT chính thức công bố kết quả điểm thi.',
    date: '2026-07-01',
    endDate: '2026-07-01',
    icon: 'clock',
    link: 'https://thisinh.thitotnghiepthpt.edu.vn',
  },
  {
    id: 'register-nv',
    step: 3,
    dateLabel: 'Từ ngày 02/7 đến 17h00 ngày 14/7/2026',
    description: 'Thí sinh đăng ký và điều chỉnh nguyện vọng xét tuyển đại học không giới hạn số lần.',
    date: '2026-07-02',
    endDate: '2026-07-14',
    icon: 'clipboard',
    link: '#match',
  },
  {
    id: 'pay-fee',
    step: 4,
    dateLabel: 'Từ ngày 15/7 đến 17h00 ngày 21/7/2026',
    description: 'Thí sinh hoàn thành nộp lệ phí xét tuyển trực tuyến.',
    date: '2026-07-15',
    endDate: '2026-07-21',
    icon: 'payment',
    link: null,
  },
  {
    id: 'round-1-result',
    step: 5,
    dateLabel: 'Trước 17h00 ngày 13/8/2026',
    description: 'Các trường Đại học thông báo danh sách thí sinh trúng tuyển đợt 1.',
    date: '2026-08-01',
    endDate: '2026-08-13',
    icon: 'megaphone',
    link: '/news',
  },
  {
    id: 'confirm-enrollment',
    step: 6,
    dateLabel: 'Trước 17h00 ngày 21/8/2026',
    description: 'Thí sinh hoàn thành xác nhận nhập học trực tuyến đợt 1 trên hệ thống.',
    date: '2026-08-14',
    endDate: '2026-08-21',
    icon: 'graduate',
    link: null,
  },
  {
    id: 'supplementary',
    step: 7,
    dateLabel: 'Từ ngày 22/8 đến tháng 12/2026',
    description: 'Các trường đại học tiếp tục xét tuyển các đợt bổ sung (nếu còn chỉ tiêu).',
    date: '2026-08-22',
    endDate: '2026-12-31',
    icon: 'university',
    link: '/universities',
  },
];

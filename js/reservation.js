(() => {
  'use strict';
  // Demo configuration only. A future server must validate and secure real slots.
  // Times follow the supplied basic-information master; the interval/horizon are demo settings.
  const config = {
    intervalMinutes: 30,
    daysAhead: 90,
    weeklyHours: {
      1: [[540, 720], [780, 1080]],
      2: [[540, 720], [780, 1080]],
      3: [[540, 720], [780, 1080]],
      5: [[540, 720], [780, 1080]],
      6: [[540, 720]]
    },
    closedDates: [], // YYYY-MM-DD: temporary closures, including holidays if needed.
    holidayDates: [], // Populate from a verified holiday source when connected.
    allowHolidays: false,
    dateOverrides: {} // YYYY-MM-DD: [[startMinute, endMinute], ...]; [] closes that date.
  };
  const form = document.querySelector('#reservation-form');
  if (!form) return;
  const find = selector => form.querySelector(selector);
  const fields = name => [...form.querySelectorAll(`[name="${name}"]`)];
  const value = name => fields(name).find(el => el.type !== 'radio' || el.checked)?.value.trim() || '';
  const steps = [...form.querySelectorAll('.reservation-step')];
  let step = 1;
  let selectedDate = '';
  let selectedTime = '';
  const japanNow = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  };
  const parseDate = key => new Date(`${key}T00:00:00Z`);
  const dateKey = date => date.toISOString().slice(0, 10);
  const shiftDate = (key, amount) => {
    const date = parseDate(key);
    date.setUTCDate(date.getUTCDate() + amount);
    return dateKey(date);
  };
  const today = japanNow().date;
  const lastDate = shiftDate(today, config.daysAhead);
  let month = parseDate(today);
  month.setUTCDate(1);
  const readableDate = key => new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  }).format(parseDate(key));
  const timeLabel = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  function slotsFor(key) {
    const now = japanNow();
    if (key < now.date || key > lastDate || config.closedDates.includes(key)) return [];
    if (config.holidayDates.includes(key) && !config.allowHolidays) return [];
    const periods = config.dateOverrides[key] ?? config.weeklyHours[parseDate(key).getUTCDay()] ?? [];
    return periods.flatMap(([start, end]) => {
      const slots = [];
      for (let minute = start; minute + config.intervalMinutes <= end; minute += config.intervalMinutes) {
        if (key !== now.date || minute > now.minutes) slots.push(timeLabel(minute));
      }
      return slots;
    });
  }
  function error(name, message) {
    find(`#${name}-error`).textContent = message;
    fields(name).forEach(field => {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    });
  }
  function renderCalendar() {
    const label = `${month.getUTCFullYear()}年${month.getUTCMonth() + 1}月`;
    find('#reservation-month').textContent = label;
    const first = new Date(month);
    const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    const cells = Math.ceil((first.getUTCDay() + end.getUTCDate()) / 7) * 7;
    const body = find('#reservation-days');
    body.replaceChildren();
    let row;
    for (let i = 0; i < cells; i++) {
      if (i % 7 === 0) { row = document.createElement('tr'); body.append(row); }
      const cell = document.createElement('td');
      row.append(cell);
      const day = i - first.getUTCDay() + 1;
      if (day < 1 || day > end.getUTCDate()) continue;
      const key = dateKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = day;
      button.dataset.date = key;
      button.disabled = slotsFor(key).length === 0;
      button.setAttribute('aria-pressed', String(key === selectedDate));
      button.setAttribute('aria-label', `${readableDate(key)}${button.disabled ? '、休診または選択不可' : '、デモ日付を選択'}`);
      if (key === today) button.setAttribute('aria-current', 'date');
      cell.append(button);
    }
    const monthKey = dateKey(month).slice(0, 7);
    find('#reservation-month-prev').disabled = monthKey <= today.slice(0, 7);
    find('#reservation-month-next').disabled = monthKey >= lastDate.slice(0, 7);
  }
  function renderTimes() {
    find('#reservation-selected-date').textContent = selectedDate ? `${readableDate(selectedDate)}（デモ）` : 'カレンダーから日付を選択してください。';
    const container = find('#reservation-time-options');
    container.replaceChildren();
    if (!selectedDate) return;
    for (const time of slotsFor(selectedDate)) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'time'; input.value = time;
      input.required = true;
      input.checked = time === selectedTime;
      input.setAttribute('aria-describedby', 'time-error');
      label.append(input, document.createTextNode(time));
      container.append(label);
    }
  }
  function renderReview() {
    const review = find('#reservation-review');
    review.replaceChildren();
    const entries = [
      ['診療内容', value('care')], ['初診・再診', value('visit')],
      ['希望日（デモ）', readableDate(selectedDate)], ['希望時間（デモ）', selectedTime],
      ['お名前', value('patient_name')], ['ふりがな', value('kana')],
      ['電話番号', value('phone')], ['メールアドレス', value('email')]
    ];
    for (const [name, content] of entries) {
      const row = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = name;
      const detail = document.createElement('dd'); detail.textContent = content;
      row.append(term, detail); review.append(row);
    }
  }
  function showStep(next) {
    step = next;
    steps.forEach((section, index) => { section.hidden = index !== step - 1; });
    document.querySelectorAll('.reservation-progress li').forEach((item, index) => {
      if (index === step - 1) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    find('#reservation-prev').hidden = step === 1;
    find('#reservation-next').hidden = step === 4;
    find('#reservation-next').textContent = step === 3 ? '入力内容を確認する' : '次へ';
    find('#reservation-step-status').textContent = `全4ステップ中、ステップ${step}`;
    if (step === 2) { renderCalendar(); renderTimes(); }
    if (step === 4) renderReview();
    find(`#reservation-step-${step}`).focus();
  }
  function validate() {
    let firstInvalid;
    const flag = (name, message, focusTarget) => {
      error(name, message);
      if (message && !firstInvalid) firstInvalid = focusTarget || fields(name)[0];
    };
    if (step === 1) {
      flag('care', value('care') ? '' : '診療内容を選択してください。');
      flag('visit', value('visit') ? '' : '初診または再診を選択してください。');
    }
    if (step === 2) {
      const available = selectedDate ? slotsFor(selectedDate) : [];
      flag('date', available.length ? '' : '選択可能な日付を選んでください。', find('#reservation-days button:not(:disabled)') || find('#reservation-month-next'));
      flag('time', selectedTime && available.includes(selectedTime) ? '' : '希望時間を選択してください。', fields('time')[0] || find('#reservation-days button:not(:disabled)'));
    }
    if (step === 3) {
      flag('patient_name', value('patient_name') ? '' : 'お名前を入力してください。');
      flag('kana', value('kana') ? (/^[ぁ-ゖー\s・]+$/u.test(value('kana')) ? '' : 'ふりがなは、ひらがなで入力してください。') : 'ふりがなを入力してください。');
      const phone = value('phone').normalize('NFKC');
      flag('phone', phone ? (/^[0-9\s()+-]+$/.test(phone) && /^\d{10,11}$/.test(phone.replace(/\D/g, '')) ? '' : '電話番号を10〜11桁の数字で入力してください（ハイフン可）。') : '電話番号を入力してください。');
      const email = fields('email')[0];
      flag('email', value('email') ? (email.validity.valid ? '' : 'メールアドレスの形式をご確認ください。') : 'メールアドレスを入力してください。');
    }
    if (firstInvalid) { firstInvalid.focus(); return false; }
    return true;
  }
  find('#reservation-days').addEventListener('click', event => {
    const button = event.target.closest('button[data-date]');
    if (!button || button.disabled) return;
    if (selectedDate !== button.dataset.date) selectedTime = '';
    selectedDate = button.dataset.date;
    error('date', ''); error('time', '');
    renderCalendar(); renderTimes();
    find(`[data-date="${selectedDate}"]`).focus({ preventScroll: true });
  });
  ['prev', 'next'].forEach((direction, index) => {
    find(`#reservation-month-${direction}`).addEventListener('click', () => {
      month.setUTCMonth(month.getUTCMonth() + (index ? 1 : -1));
      renderCalendar();
    });
  });
  form.addEventListener('change', event => {
    if (event.target.name === 'time') selectedTime = event.target.value;
    if (['care', 'visit', 'time'].includes(event.target.name)) error(event.target.name, '');
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); // This demo must never send personal data or confirm a booking.
    if (step < 4 && validate()) showStep(step + 1);
  });
  find('#reservation-prev').addEventListener('click', () => showStep(step - 1));
  form.querySelectorAll('[data-edit-step]').forEach(button => {
    button.addEventListener('click', () => showStep(Number(button.dataset.editStep)));
  });
  form.hidden = false;
  renderCalendar();
})();

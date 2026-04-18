// تنسيقات مساعدة
export const fmtCurrency = (v: number, currency = "د.ع") => {
  const n = Math.round(v).toLocaleString("en-US");
  return `${n} ${currency}`;
};

export const fmtNumber = (v: number) => v.toLocaleString("en-US");

export const fmtDateTime = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleDateString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

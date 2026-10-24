// annual gross -> annual tax
function annualTax(annualGross) {
  if (annualGross <= 600000) return 0;
  if (annualGross <= 1200000) return 0.05 * (annualGross - 600000);
  if (annualGross <= 2400000) return 30000 + 0.15 * (annualGross - 1200000);
  if (annualGross <= 3600000) return 210000 + 0.25 * (annualGross - 2400000);
  return 510000 + 0.35 * (annualGross - 3600000);
}

function monthlyTax(monthlyGross) {
  return annualTax(monthlyGross * 12) / 12;
}

module.exports = { annualTax, monthlyTax };

let counter = 0;
function v4() {
  counter++;
  const padded = String(counter).padStart(12, "0");
  return `00000000-0000-0000-0000-${padded}`;
}
module.exports = { v4 };
module.exports.v4 = v4;
module.exports.default = { v4 };

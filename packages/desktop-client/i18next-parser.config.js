module.exports = {
  input: ['src/**/*.{js,jsx,ts,tsx}', '../loot-core/src/**/*.{js,jsx,ts,tsx}'],
  output: 'locale/$LOCALE.json',
  locales: ['en'],
  sort: true,
  // en.json is regenerated on every build; no need for an en_old.json copy
  createOldCatalogs: false,
  keySeparator: false,
  namespaceSeparator: false,
  defaultValue: (locale, ns, key, value) => {
    if (locale === 'en') {
      return value || key;
    }
    return '';
  },
};

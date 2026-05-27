interface Theme {
  name: string;
  className: string;
  variables: { [key: string]: string };
}

interface ThemeTypes {
  [key: string]: Theme;
}

# M-RP Sultan LSPD 3D Studio

Webowy edytor oznaczeń Sultana na prawdziwej geometrii GLB przygotowanej z DFF/TXD V10. Edytuje nakładki 3D (LS, herb, PD, POLICE i belka), kolor lakieru i drzwi w podglądzie. Wspiera telefon i komputer.

## Uruchomienie na GitHub Pages

1. Utwórz nowe publiczne repozytorium `mrp-lspd-studio` na swoim koncie GitHub.
2. Wgraj **zawartość** tego folderu (nie ZIP jako pojedynczy plik) na gałąź `main`, łącznie z katalogiem `assets` i `.github/workflows`.
3. W `Settings → Pages → Build and deployment → Source` ustaw `GitHub Actions`.
4. Otwórz `Actions` i sprawdź workflow `GitHub Pages — M-RP LSPD Studio`. Po poprawnym wdrożeniu adres ma format `https://<login>.github.io/mrp-lspd-studio/`.

## Uwagi

- Model GLB to konwersja DFF, a nie silnik renderowania GTA:SA; część materiałów i low-poly kół może się różnić od MTA.
- Zmiany zapisują się do JSON. Nie modyfikują bezpośrednio DFF/TXD.
- Biblioteka Three.js jest pobierana z jsDelivr; strona wymaga internetu.
- GitHub Pages publikuje zawartość repozytorium. Nie wrzucaj danych poufnych ani haseł.

## Alternatywa: jeden plik HTML

`mrp-lspd-studio-standalone.html` to samodzielny plik ze wszystkimi stylami, skryptem i modelem GLB w środku. Można go przesłać na GitHub jako `index.html` bez żadnych innych plików. Internet jest nadal potrzebny do modułów Three.js. Na GitHub Pages wystarczy Source: Deploy from a branch, Branch: main, Folder: /(root).

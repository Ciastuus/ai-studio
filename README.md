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

## Eksport do rzeczywistych DFF i TXD (wersja HTML)

W edytorze wybierz **Eksport prawdziwych DFF / TXD**. Wskaż oba **oryginalne pliki bazowego M-RP Sultan LSPD V10** (z folderu `files` w paczce V10), a następnie kliknij **Utwórz DFF + TXD w ZIP**.

Konwersja odbywa się wyłącznie w przeglądarce, bez przesyłania binarnych plików na serwer. Zapisuje:
- **TXD**: atlas DXT3 512×512 z pozycjami i skalą LS, badge i PD wypalonymi w oryginalnych UV drzwi oraz wybranym kolorem drzwi.
- **DFF**: translację belki oraz pozycje i skalę napisów POLICE na masce i bagażniku (rzeczywiste wierzchołki).
- **JSON**: zapis wszystkich ustawień dla kolejnej edycji.

Archiwum zawiera `files/sultan_lspd.dff`, `files/sultan.txd` i pliki informacyjne. Podmień DFF/TXD w istniejącym zasobie MTA:SA; zachowaj pozostałe skrypty i meta.xml zasobu. Wymagana jest wersja bazowa V10 — mechanizm weryfikuje długość plików i SHA-256, aby nie nadpisać niezgodnego modelu.

**Ograniczenia:** kolor lakieru w MTA sterowany jest przez `setVehicleColor` (Lua); sam DFF/TXD nie zastępuje tego wywołania. Weryfikacja syntaktyczna i testy kodowania DXT3/ZIP wykonywane są w GitHub Actions. Wyświetlanie w kliencie MTA:SA wymaga osobnego testu.

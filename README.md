# Portál za izbor maturskih teme - Lokalna instalacija

## Korak 1: Instalacija Node.js

Ako nemaš Node.js:
1. Idi na https://nodejs.org/
2. Preuzmi LTS verziju
3. Instaliraj (accept sve default opcije)

Proveri instalaciju - otvori terminal i ukucaj:
```
node --version
npm --version
```

## Korak 2: Instalacija dependencija

U folder `maturskiPortal`, otvori PowerShell/Terminal i ukucaj:

```powershell
npm install
```

Ovo će instalirati Express, SQLite, CSV parser i ostalo potrebno.

## Korak 3: Inicijalizacija baze podataka

Učitaj sve CSV podatke u SQLite bazu:

```powershell
npm run init-db
```

Trebao bi da vidiš:
```
✅ Baza podataka je uspesno inicijalizirana!
```

## Korak 4: Pokretanje aplikacije

Pokreni server:

```powershell
npm start
```

Trebao bi da vidiš:
```
Server pokrenut na http://localhost:3000
```

## Korak 5: Otvaranje u pregledniku

Otvori pregledac i idi na:
```
http://localhost:3000
```

## Testiranje tokena

Koristi jedan od ovih tokena (iz `MaturskeTeme - students.csv`):
- `IV9-2526-0F9R0` (Михајло А)
- `IV9-2526-5kpz6` (Јован A)
- Itd...

## Gašenje servera

Pritisni **Ctrl + C** u terminalu gdje je server pokrenut.

## Restart

Samo ponovi:
```powershell
npm start
```

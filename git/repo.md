# repo

## init

```shell
echo "# diffraction" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Josp3r/diffraction.git
git push -u origin main
```

## modify origin

```shell
git remote remove origin
git remote add origin neworigin
```

## show origin

```shell
git remote show origin
```

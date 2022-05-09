# workflow

## init

```shell
git init [-q | --quiet] [--bare] [--template=<template_directory>]
      [--separate-git-dir <git dir>]
      [--shared[=<permissions>]] [directory]

```

## commit & push

```shell
# add staged files (. means all, also you can add a absolute file name)
git add .
# commit, use husky or cz is good.
git commit -m "msg"
# pull
git pull --rebase
# git rebase --abort
# push
git push
```

## merge

```shell
git checkout main
git merge branch-name
# git add .
# git merge --abort
git push
```

## change branch name

```shell
git checkout old-branch
git branch -M new-branch
```

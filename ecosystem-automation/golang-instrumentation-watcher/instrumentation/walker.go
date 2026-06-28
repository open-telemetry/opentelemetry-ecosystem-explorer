package instrumentation

import (
	"os"
	"path/filepath"
	"strings"
)

var omitDirectories = []string{
	"example",
	"internal",
	"test",
}

type Package struct {
	Path      string
	GoModPath string
}

func Walk(rootPath string) ([]Package, error) {
	var packages []Package

	err := filepath.WalkDir(rootPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() && omitDirectory(d.Name()) {
			return filepath.SkipDir
		}

		if !d.IsDir() && d.Name() == "go.mod" {
			relPath, err := filepath.Rel(rootPath, filepath.Dir(path))
			if err != nil {
				return err
			}

			if omitDirectoryPath(relPath) {
				return nil
			}

			pkg := Package{
				Path:      relPath,
				GoModPath: path,
			}
			packages = append(packages, pkg)
		}

		return nil
	})

	return packages, err
}

func omitDirectory(name string) bool {
	for _, dir := range omitDirectories {
		if name == dir {
			return true
		}
	}
	return false
}

func omitDirectoryPath(relPath string) bool {
	for _, seg := range strings.Split(relPath, string(filepath.Separator)) {
		if omitDirectory(seg) {
			return true
		}
	}
	return false
}

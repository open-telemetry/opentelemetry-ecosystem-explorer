package instrumentation

import (
	"os"
	"path/filepath"
)

var omitDirectories = []string{
	"example",
	"internal",
	"test",
}

// Package is a Go module discovered by [Walk]: Path is its location relative to
// the scan root and GoModPath is the absolute path to its go.mod.
type Package struct {
	Path      string
	GoModPath string
}

// Walk finds every go.mod under rootPath and returns the discovered [Package]
// values. Directories named "example", "internal", or "test" are skipped.
func Walk(rootPath string) ([]Package, error) {
	var packages []Package

	err := filepath.WalkDir(rootPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			if omitDirectory(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}

		if d.Name() == "go.mod" {
			relPath, err := filepath.Rel(rootPath, filepath.Dir(path))
			if err != nil {
				return err
			}
			packages = append(packages, Package{Path: relPath, GoModPath: path})
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

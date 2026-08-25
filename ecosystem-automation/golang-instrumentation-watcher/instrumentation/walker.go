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

// MetadataFile is a metadata.yaml file discovered by [WalkMetadata]: Path is its location relative to
// the scan root and MetadataPath is the absolute path to its metadata.yaml.
type MetadataFile struct {
	Path         string
	MetadataPath string
}

type discoveredFile struct {
	RelPath  string
	FilePath string
}

// Walk finds every go.mod under rootPath and returns the discovered [Package]
// values. Directories named "example", "internal", or "test" are skipped.
func Walk(rootPath string) ([]Package, error) {
	files, err := walkMatchingFile(rootPath, "go.mod")
	if err != nil {
		return nil, err
	}
	var packages []Package
	for _, f := range files {
		packages = append(packages, Package{Path: f.RelPath, GoModPath: f.FilePath})
	}
	return packages, nil
}

// WalkMetadata finds every metadata.yaml under rootPath and returns the discovered [MetadataFile]
// values. Directories named "example", "internal", or "test" are skipped.
func WalkMetadata(rootPath string) ([]MetadataFile, error) {
	files, err := walkMatchingFile(rootPath, "metadata.yaml")
	if err != nil {
		return nil, err
	}
	var metaFiles []MetadataFile
	for _, f := range files {
		metaFiles = append(metaFiles, MetadataFile{Path: f.RelPath, MetadataPath: f.FilePath})
	}
	return metaFiles, nil
}

func walkMatchingFile(rootPath, targetFilename string) ([]discoveredFile, error) {
	var files []discoveredFile

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

		if d.Name() == targetFilename {
			relPath, err := filepath.Rel(rootPath, filepath.Dir(path))
			if err != nil {
				return err
			}
			files = append(files, discoveredFile{RelPath: relPath, FilePath: path})
		}

		return nil
	})

	return files, err
}

func omitDirectory(name string) bool {
	for _, dir := range omitDirectories {
		if name == dir {
			return true
		}
	}
	return false
}

import { isArchive } from "./FileStorage";

describe("isArchive", () => {
  it("should return true for .tar.gz files", () => {
    expect(isArchive("archive.tar.gz")).toBe(true);
  });

  it("should return true for .tgz files", () => {
    expect(isArchive("package.tgz")).toBe(true);
  });

  it("should return true for .zip files", () => {
    expect(isArchive("docs.zip")).toBe(true);
  });

  it("should return true for uppercase archive extensions", () => {
    expect(isArchive("ARCHIVE.TAR.GZ")).toBe(true);
    expect(isArchive("ARCHIVE.TGZ")).toBe(true);
    expect(isArchive("ARCHIVE.ZIP")).toBe(true);
  });

  it("should return false for non-archive files", () => {
    expect(isArchive("readme.txt")).toBe(false);
    expect(isArchive("data.json")).toBe(false);
    expect(isArchive("file.tar")).toBe(false);
    expect(isArchive("file.gz")).toBe(false);
    expect(isArchive("")).toBe(false);
  });
});

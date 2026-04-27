namespace LinkedPushApi.Services;

public interface IMediaStorageService
{
    Task<string> SaveVideoAsync(Stream data, string filename, CancellationToken ct = default);
    Task<string> SaveDocumentAsync(Stream data, string filename, CancellationToken ct = default);
    Task<Stream?> GetFileStreamAsync(string storageKey);
    Task DeleteFileAsync(string storageKey);
    string GetPublicUrl(string storageKey);
    string StorageType { get; }
}

public class LocalMediaStorageService : IMediaStorageService
{
    private readonly string _uploadsBase;
    private readonly string _publicBaseUrl;

    public string StorageType => "local";

    public LocalMediaStorageService(IConfiguration config)
    {
        _uploadsBase = config["UploadsPath"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads");
        _publicBaseUrl = config["LocalMediaBaseUrl"]
            ?? "http://localhost:8000/api/media";
    }

    private string GetDir(string sub) => Path.Combine(_uploadsBase, sub);

    private void EnsureDir(string sub)
    {
        var dir = GetDir(sub);
        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
    }

    public async Task<string> SaveVideoAsync(Stream data, string filename, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(filename).TrimStart('.');
        var key = $"videos/{Guid.NewGuid():N}.{ext}";
        EnsureDir("videos");
        var path = Path.Combine(GetDir("videos"), Path.GetFileName(key));
        await using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
        await data.CopyToAsync(fs, ct);
        return key;
    }

    public async Task<string> SaveDocumentAsync(Stream data, string filename, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(filename).TrimStart('.');
        var key = $"documents/{Guid.NewGuid():N}.{ext}";
        EnsureDir("documents");
        var path = Path.Combine(GetDir("documents"), Path.GetFileName(key));
        await using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
        await data.CopyToAsync(fs, ct);
        return key;
    }

    public Task<Stream?> GetFileStreamAsync(string storageKey)
    {
        var path = Path.Combine(_uploadsBase, storageKey);
        if (!File.Exists(path)) return Task.FromResult<Stream?>(null);
        Stream s = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
        return Task.FromResult<Stream?>(s);
    }

    public Task DeleteFileAsync(string storageKey)
    {
        var path = Path.Combine(_uploadsBase, storageKey);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public string GetPublicUrl(string storageKey) => $"{_publicBaseUrl}/file/{storageKey}";
}

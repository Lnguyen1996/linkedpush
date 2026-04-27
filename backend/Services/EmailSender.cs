using Microsoft.Extensions.Configuration;

namespace LinkedPushApi.Services;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody);
}

public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _log;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> log)
    {
        _config = config;
        _log = log;
    }

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (!AppConfig.EmailEnabled(_config))
        {
            _log.LogDebug("Email sending disabled, skipping to {To}", to);
            return;
        }

        var host = AppConfig.SmtpHost(_config);
        var port = AppConfig.SmtpPort(_config);
        var user = AppConfig.SmtpUser(_config);
        var password = AppConfig.SmtpPassword(_config);
        var from = AppConfig.SmtpFrom(_config);

        using var client = new System.Net.Mail.SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new System.Net.NetworkCredential(user, password),
        };

        var msg = new System.Net.Mail.MailMessage(from, to, subject, htmlBody) { IsBodyHtml = true };
        await client.SendMailAsync(msg);
        _log.LogInformation("Email sent to {To}: {Subject}", to, subject);
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("user_notification_preferences")]
public class UserNotificationPreference
{
    [Key]
    [Column("user_id")]
    public int UserId { get; set; }

    [Column("email_enabled")]
    public bool EmailEnabled { get; set; } = false;

    [Column("post_published_email")]
    public bool PostPublishedEmail { get; set; } = false;

    [Column("post_failed_email")]
    public bool PostFailedEmail { get; set; } = true;

    [Column("weekly_digest_email")]
    public bool WeeklyDigestEmail { get; set; } = true;

    [MaxLength(10)]
    [Column("weekly_digest_day")]
    public string WeeklyDigestDay { get; set; } = "monday"; // monday-sunday

    [MaxLength(5)]
    [Column("digest_time_of_day")]
    public string DigestTimeOfDay { get; set; } = "09:00"; // HH:MM

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;
}
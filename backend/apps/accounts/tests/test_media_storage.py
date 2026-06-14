"""Tests for media volume cleanup helpers."""

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import SimpleTestCase, TestCase, override_settings

from apps.accounts.services.media_storage import (
    delete_media_by_url,
    delete_media_file,
    delete_replaced_media_url,
    media_url_to_relative_path,
)


class MediaUrlParsingTests(SimpleTestCase):
    def test_relative_media_url(self):
        self.assertEqual(
            media_url_to_relative_path("/media/gold_rates_ad_images/general/abc.jpg"),
            "gold_rates_ad_images/general/abc.jpg",
        )

    def test_absolute_media_url(self):
        self.assertEqual(
            media_url_to_relative_path(
                "https://example.com/media/profile_photos/1/photo.jpg"
            ),
            "profile_photos/1/photo.jpg",
        )

    def test_external_url_ignored(self):
        self.assertIsNone(media_url_to_relative_path("https://cdn.example.com/banner.jpg"))

    def test_path_traversal_rejected(self):
        self.assertIsNone(media_url_to_relative_path("/media/../etc/passwd"))


@override_settings(MEDIA_ROOT="/tmp/test-media")
class MediaDeleteTests(TestCase):
    def test_delete_managed_upload(self):
        rel = "gold_rates_ad_images/general/test-delete.jpg"
        default_storage.save(rel, ContentFile(b"test"))
        self.assertTrue(default_storage.exists(rel))
        self.assertTrue(delete_media_file(rel))
        self.assertFalse(default_storage.exists(rel))

    def test_delete_by_url(self):
        rel = "profile_photos/9/avatar.webp"
        default_storage.save(rel, ContentFile(b"x"))
        self.assertTrue(delete_media_by_url(f"/media/{rel}"))
        self.assertFalse(default_storage.exists(rel))

    def test_unmanaged_prefix_not_deleted(self):
        rel = "other_uploads/keep.me"
        default_storage.save(rel, ContentFile(b"x"))
        self.assertFalse(delete_media_file(rel))
        self.assertTrue(default_storage.exists(rel))
        default_storage.delete(rel)

    def test_delete_replaced_media_url(self):
        old_rel = "jeweller_logos/3/old.png"
        new_rel = "jeweller_logos/3/new.png"
        default_storage.save(old_rel, ContentFile(b"old"))
        default_storage.save(new_rel, ContentFile(b"new"))
        delete_replaced_media_url(
            old_url=f"/media/{old_rel}",
            new_url=f"/media/{new_rel}",
        )
        self.assertFalse(default_storage.exists(old_rel))
        self.assertTrue(default_storage.exists(new_rel))
        default_storage.delete(new_rel)

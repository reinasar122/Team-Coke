from django.db import models

class Warehouse(models.Model):
    name = models.CharField(max_length=255, unique=True)
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    phone_number = models.CharField(max_length=50)
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.name
# Бэкенд конструктора журналов

Стартовое приложение Spring Boot 4.1.2 с Spring MVC и Actuator. Для локального запуска установите JDK 21 и укажите его в `JAVA_HOME`. Для первой сборки нужен доступ к Maven Central. Maven Wrapper входит в проект.

В IntelliJ IDEA откройте `backend/pom.xml` как Maven-проект или подключите этот файл в окне Maven уже открытого репозитория. Выберите JDK 21 как Project SDK и Maven Wrapper как версию Maven. После синхронизации запустите класс `LogBuilderApplication`.

Для запуска приложения подготовьте базу PostgreSQL и пользователя с правом создавать объекты в её схеме. По умолчанию приложение подключается к базе `log_builder` на localhost:5432 под пользователем `log_builder`. Параметры подключения задаются через `DB_URL`, `DB_USER` и `DB_PASSWORD`; в IntelliJ IDEA их можно задать в конфигурации запуска. При старте Flyway применяет миграции V1–V6, затем Hibernate проверяет соответствие моделей схеме.

Для локальных параметров также поддерживается файл `backend/.env` с ключами `DB_URL`, `DB_USER` и `DB_PASSWORD`. Он загружается при запуске из корня репозитория или каталога `backend` и исключён из Git. Переменные окружения имеют приоритет над значениями файла.

Для сборки и запуска из корня репозитория выполните в PowerShell:

```powershell
cd backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

В другом окне выполните `Invoke-RestMethod http://localhost:8080/actuator/health`. У запущенного приложения поле `status` равно `UP`. Чтобы остановить сервер, нажмите Ctrl+C.

Swagger UI доступен по адресу http://localhost:8080/swagger-ui/index.html, спецификация OpenAPI — http://localhost:8080/v3/api-docs. Документация формируется автоматически по REST-контроллерам. По мере реализации API его операции будут появляться в Swagger UI.

Тесты Maven используют отдельный временный экземпляр PostgreSQL. После сборки приложение можно запустить из каталога `backend` командой PowerShell `& "$env:JAVA_HOME/bin/java.exe" -jar target/log-builder-0.0.1-SNAPSHOT.jar`.

[Схема и ограничения базы данных](../docs/database-design.md) · [SQL-миграции](src/main/resources/db/migration) · [JPA-модели](src/main/java/ru/clearbarn/logbuilder/model)

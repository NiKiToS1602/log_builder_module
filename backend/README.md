# Бэкенд конструктора журналов

Стартовое приложение Spring Boot 4.1.2 с Spring MVC и Actuator. Для локального запуска установите JDK 21 и укажите его в `JAVA_HOME`. Для первой сборки нужен доступ к Maven Central. Maven Wrapper входит в проект.

В IntelliJ IDEA откройте `backend/pom.xml` как Maven-проект или подключите этот файл в окне Maven уже открытого репозитория. Выберите JDK 21 как Project SDK и Maven Wrapper как версию Maven. После синхронизации запустите класс `LogBuilderApplication`.

Из корня репозитория в PowerShell выполните:

```powershell
cd backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

В другом окне выполните `Invoke-RestMethod http://localhost:8080/actuator/health`. У запущенного приложения поле `status` равно `UP`. Чтобы остановить сервер, нажмите Ctrl+C.

После сборки приложение можно запустить из каталога `backend` командой PowerShell `& "$env:JAVA_HOME/bin/java.exe" -jar target/log-builder-0.0.1-SNAPSHOT.jar`. Подключение БД, вход через ClearBarn и прикладные маршруты описаны в [календарном плане разработки](../docs/backend-work-plan.md).

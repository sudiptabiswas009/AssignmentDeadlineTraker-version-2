import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiServer {

    public static void main(String[] args) throws Exception {

        int port = Integer.parseInt(
                System.getenv().getOrDefault("PORT", "8080")
        );

        HttpServer server = HttpServer.create(
                new InetSocketAddress("0.0.0.0", port),
                0
        );

        server.createContext(
                "/api/assignments",
                ApiServer::handleAssignments
        );

        server.createContext(
                "/api/upcoming",
                ApiServer::handleUpcoming
        );

        server.createContext(
                "/api/add",
                ApiServer::handleAdd
        );

        // DELETE /api/delete/{id}
        server.createContext(
                "/api/delete",
                ApiServer::handleDelete
        );

        // PATCH /api/complete/{id}
        server.createContext(
                "/api/complete",
                ApiServer::handleComplete
        );

        // PATCH /api/edit/{id}
        server.createContext(
                "/api/edit",
                ApiServer::handleEdit
        );

        server.start();

        System.out.println(
                "API Server running on port " + port
        );
    }

    // =========================================
    // GET /api/assignments
    // =========================================

    private static void handleAssignments(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        getAllAssignments(exchange);
    }

    // =========================================
    // GET /api/upcoming
    // =========================================

    private static void handleUpcoming(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        getUpcomingAssignments(exchange);
    }

    // =========================================
    // POST /api/add
    // =========================================

    private static void handleAdd(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        addAssignment(exchange);
    }

    // =========================================
    // DELETE /api/delete/{id}
    // =========================================

    private static void handleDelete(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("DELETE")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        String path = exchange.getRequestURI().getPath();

        String prefix = "/api/delete/";

        if (!path.startsWith(prefix)) {
            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Assignment ID is required\"}"
            );
            return;
        }

        String idText = path.substring(prefix.length());

        try {

            int id = Integer.parseInt(idText);

            deleteAssignment(exchange, id);

        }
        catch (NumberFormatException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid assignment ID\"}"
            );
        }
    }

    // =========================================
    // DELETE ASSIGNMENT
    // =========================================

    private static void deleteAssignment(
            HttpExchange exchange,
            int id
    ) throws IOException {

        String sql =
                "DELETE FROM assignments WHERE id = ?";

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

            statement.setInt(1, id);

            int rows =
                    statement.executeUpdate();

            if (rows > 0) {

                sendJson(
                        exchange,
                        200,
                        "{\"message\":\"Assignment deleted successfully\"}"
                );

            }
            else {

                sendJson(
                        exchange,
                        404,
                        "{\"error\":\"Assignment not found\"}"
                );
            }

        }
        catch (SQLException e) {

            System.out.println(
                    "Database error: " +
                    e.getMessage()
            );

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );
        }
    }

    // =========================================
    // PATCH /api/complete/{id}
    // =========================================

    private static void handleComplete(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("PATCH")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        String path =
                exchange.getRequestURI().getPath();

        String prefix =
                "/api/complete/";

        if (!path.startsWith(prefix)) {
            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Assignment ID is required\"}"
            );
            return;
        }

        String idText =
                path.substring(prefix.length());

        try {

            int id =
                    Integer.parseInt(idText);

            completeAssignment(exchange, id);

        }
        catch (NumberFormatException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid assignment ID\"}"
            );
        }
    }

    // =========================================
    // COMPLETE ASSIGNMENT
    // =========================================

    private static void completeAssignment(
            HttpExchange exchange,
            int id
    ) throws IOException {

        String sql =
                "UPDATE assignments " +
                "SET status = 'Completed' " +
                "WHERE id = ?";

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

            statement.setInt(1, id);

            int rows =
                    statement.executeUpdate();

            if (rows > 0) {

                sendJson(
                        exchange,
                        200,
                        "{\"message\":\"Assignment marked as completed\"}"
                );

            }
            else {

                sendJson(
                        exchange,
                        404,
                        "{\"error\":\"Assignment not found\"}"
                );
            }

        }
        catch (SQLException e) {

            System.out.println(
                    "Database error: " +
                    e.getMessage()
            );

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );
        }
    }

    // =========================================
    // PATCH /api/edit/{id}
    // =========================================

    private static void handleEdit(
            HttpExchange exchange
    ) throws IOException {

        addCorsHeaders(exchange);

        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            handlePreflight(exchange);
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("PATCH")) {
            sendJson(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}"
            );
            return;
        }

        String path =
                exchange.getRequestURI().getPath();

        String prefix =
                "/api/edit/";

        if (!path.startsWith(prefix)) {
            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Assignment ID is required\"}"
            );
            return;
        }

        String idText =
                path.substring(prefix.length());

        try {

            int id =
                    Integer.parseInt(idText);

            editAssignment(exchange, id);

        }
        catch (NumberFormatException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid assignment ID\"}"
            );
        }
    }

    // =========================================
    // EDIT ASSIGNMENT
    // =========================================

    private static void editAssignment(
            HttpExchange exchange,
            int id
    ) throws IOException {

        String body =
                readRequestBody(exchange);

        try {

            String title =
                    extractJsonValue(
                            body,
                            "title"
                    );

            String subject =
                    extractJsonValue(
                            body,
                            "subject"
                    );

            String description =
                    extractJsonValue(
                            body,
                            "description"
                    );

            String deadline =
                    extractJsonValue(
                            body,
                            "deadline"
                    );

            String status =
                    extractJsonValue(
                            body,
                            "status"
                    );

            if (
                    title == null ||
                    subject == null ||
                    deadline == null ||
                    status == null
            ) {

                sendJson(
                        exchange,
                        400,
                        "{\"error\":\"Missing required fields\"}"
                );

                return;
            }

            String sql =
                    "UPDATE assignments " +
                    "SET title = ?, " +
                    "subject = ?, " +
                    "description = ?, " +
                    "deadline = ?, " +
                    "status = ? " +
                    "WHERE id = ?";

            try (
                    Connection connection =
                            DatabaseManager.getConnection();

                    PreparedStatement statement =
                            connection.prepareStatement(sql)
            ) {

                statement.setString(1, title);

                statement.setString(2, subject);

                statement.setString(3, description);

                statement.setDate(
                        4,
                        java.sql.Date.valueOf(deadline)
                );

                statement.setString(5, status);

                statement.setInt(6, id);

                int rows =
                        statement.executeUpdate();

                if (rows > 0) {

                    sendJson(
                            exchange,
                            200,
                            "{\"message\":\"Assignment updated successfully\"}"
                    );

                }
                else {

                    sendJson(
                            exchange,
                            404,
                            "{\"error\":\"Assignment not found\"}"
                    );
                }
            }

        }
        catch (IllegalArgumentException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid deadline format\"}"
            );

        }
        catch (SQLException e) {

            System.out.println(
                    "Database error: " +
                    e.getMessage()
            );

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );
        }
    }

    // =========================================
    // CORS
    // =========================================

    private static void addCorsHeaders(
            HttpExchange exchange
    ) {

        Headers headers =
                exchange.getResponseHeaders();

        String origin =
                exchange.getRequestHeaders()
                        .getFirst("Origin");

        if (
                "https://app.sudipta.dpdns.org".equals(origin) ||
                "http://localhost:3000".equals(origin)
        ) {
            headers.set(
                    "Access-Control-Allow-Origin",
                    origin
            );
        }

        headers.set(
                "Access-Control-Allow-Methods",
                "GET, POST, DELETE, PATCH, OPTIONS"
        );

        headers.set(
                "Access-Control-Allow-Headers",
                "Content-Type"
        );
    }

    private static void handlePreflight(
            HttpExchange exchange
    ) throws IOException {

        exchange.sendResponseHeaders(
                204,
                -1
        );

        exchange.close();
    }

    // =========================================
    // GET ALL ASSIGNMENTS
    // =========================================

    private static void getAllAssignments(
            HttpExchange exchange
    ) throws IOException {

        String sql =
                "SELECT * FROM assignments " +
                "ORDER BY deadline";

        StringBuilder json =
                new StringBuilder();

        json.append("[");

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql);

                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean first = true;

            while (result.next()) {

                if (!first) {
                    json.append(",");
                }

                first = false;

                json.append("{");

                json.append("\"id\":")
                        .append(result.getInt("id"))
                        .append(",");

                json.append("\"title\":\"")
                        .append(
                                escapeJson(
                                        result.getString("title")
                                )
                        )
                        .append("\",");

                json.append("\"subject\":\"")
                        .append(
                                escapeJson(
                                        result.getString("subject")
                                )
                        )
                        .append("\",");

                json.append("\"description\":\"")
                        .append(
                                escapeJson(
                                        result.getString("description")
                                )
                        )
                        .append("\",");

                json.append("\"deadline\":\"")
                        .append(
                                result.getDate("deadline")
                        )
                        .append("\",");

                json.append("\"status\":\"")
                        .append(
                                escapeJson(
                                        result.getString("status")
                                )
                        )
                        .append("\"");

                json.append("}");
            }

            json.append("]");

            sendJson(
                    exchange,
                    200,
                    json.toString()
            );

        }
        catch (SQLException e) {

            System.out.println(
                    "Database error: " +
                    e.getMessage()
            );

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );
        }
    }

    // =========================================
    // UPCOMING ASSIGNMENTS
    // =========================================

    private static void getUpcomingAssignments(
            HttpExchange exchange
    ) throws IOException {

        String sql =
                "SELECT * FROM assignments " +
                "WHERE status = 'Pending' " +
                "AND deadline BETWEEN CURDATE() " +
                "AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) " +
                "ORDER BY deadline";

        StringBuilder json =
                new StringBuilder();

        json.append("[");

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql);

                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean first = true;

            while (result.next()) {

                if (!first) {
                    json.append(",");
                }

                first = false;

                json.append("{");

                json.append("\"id\":")
                        .append(result.getInt("id"))
                        .append(",");

                json.append("\"title\":\"")
                        .append(
                                escapeJson(
                                        result.getString("title")
                                )
                        )
                        .append("\",");

                json.append("\"subject\":\"")
                        .append(
                                escapeJson(
                                        result.getString("subject")
                                )
                        )
                        .append("\",");

                json.append("\"deadline\":\"")
                        .append(
                                result.getDate("deadline")
                        )
                        .append("\",");

                json.append("\"status\":\"")
                        .append(
                                escapeJson(
                                        result.getString("status")
                                )
                        )
                        .append("\"");

                json.append("}");
            }

            json.append("]");

            sendJson(
                    exchange,
                    200,
                    json.toString()
            );

        }
        catch (SQLException e) {

            System.out.println(
                    "Database error: " +
                    e.getMessage()
            );

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );
        }
    }

    // =========================================
    // ADD ASSIGNMENT
    // =========================================

    private static void addAssignment(
            HttpExchange exchange
    ) throws IOException {

        String body =
                readRequestBody(exchange);

        try {

            int id =
                    Integer.parseInt(
                            extractJsonValue(
                                    body,
                                    "id"
                            )
                    );

            String title =
                    extractJsonValue(
                            body,
                            "title"
                    );

            String subject =
                    extractJsonValue(
                            body,
                            "subject"
                    );

            String description =
                    extractJsonValue(
                            body,
                            "description"
                    );

            String deadline =
                    extractJsonValue(
                            body,
                            "deadline"
                    );

            String status =
                    extractJsonValue(
                            body,
                            "status"
                    );

            if (
                    title == null ||
                    subject == null ||
                    deadline == null ||
                    status == null
            ) {

                sendJson(
                        exchange,
                        400,
                        "{\"error\":\"Missing required fields\"}"
                );

                return;
            }

            String sql =
                    "INSERT INTO assignments " +
                    "(id, title, subject, description, deadline, status) " +
                    "VALUES (?, ?, ?, ?, ?, ?)";

            try (
                    Connection connection =
                            DatabaseManager.getConnection();

                    PreparedStatement statement =
                            connection.prepareStatement(sql)
            ) {

                statement.setInt(1, id);

                statement.setString(2, title);

                statement.setString(3, subject);

                statement.setString(4, description);

                statement.setDate(
                        5,
                        java.sql.Date.valueOf(deadline)
                );

                statement.setString(6, status);

                statement.executeUpdate();

                sendJson(
                        exchange,
                        200,
                        "{\"message\":\"Assignment added successfully\"}"
                );
            }

        }
        catch (NumberFormatException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid ID\"}"
            );

        }
        catch (IllegalArgumentException e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid deadline format\"}"
            );

        }
        catch (SQLException e) {

            if (
                    e.getMessage() != null &&
                    e.getMessage().contains("Duplicate")
            ) {

                sendJson(
                        exchange,
                        409,
                        "{\"error\":\"Assignment ID already exists\"}"
                );

            }
            else {

                System.out.println(
                        "Database error: " +
                        e.getMessage()
                );

                sendJson(
                        exchange,
                        500,
                        "{\"error\":\"Database error\"}"
                );
            }
        }
    }

    // =========================================
    // READ REQUEST BODY
    // =========================================

    private static String readRequestBody(
            HttpExchange exchange
    ) throws IOException {

        try (
                InputStream input =
                        exchange.getRequestBody()
        ) {

            return new String(
                    input.readAllBytes(),
                    StandardCharsets.UTF_8
            );
        }
    }

    // =========================================
    // EXTRACT JSON VALUE
    // =========================================

    private static String extractJsonValue(
            String json,
            String key
    ) {

        String pattern =
                "\""
                        + Pattern.quote(key)
                        + "\"\\s*:\\s*\"([^\"]*)\"";

        Matcher matcher =
                Pattern.compile(pattern)
                        .matcher(json);

        if (matcher.find()) {
            return matcher.group(1);
        }

        String numberPattern =
                "\""
                        + Pattern.quote(key)
                        + "\"\\s*:\\s*([0-9]+)";

        Matcher numberMatcher =
                Pattern.compile(numberPattern)
                        .matcher(json);

        if (numberMatcher.find()) {
            return numberMatcher.group(1);
        }

        return null;
    }

    // =========================================
    // ESCAPE JSON
    // =========================================

    private static String escapeJson(
            String value
    ) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // =========================================
    // SEND JSON RESPONSE
    // =========================================

    private static void sendJson(
            HttpExchange exchange,
            int statusCode,
            String json
    ) throws IOException {

        byte[] response =
                json.getBytes(
                        StandardCharsets.UTF_8
                );

        exchange.getResponseHeaders()
                .set(
                        "Content-Type",
                        "application/json"
                );

        exchange.sendResponseHeaders(
                statusCode,
                response.length
        );

        try (
                OutputStream output =
                        exchange.getResponseBody()
        ) {

            output.write(response);
        }
    }
}

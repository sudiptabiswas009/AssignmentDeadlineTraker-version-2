import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.InputMismatchException;
import java.util.Scanner;

public class AssignmentManager {
       

    // =========================================================
    // 1. ADD ASSIGNMENT
    // =========================================================

    public static void addAssignment(Scanner sc) {

        // ID
        System.out.print("Enter ID: ");

        int id;

        try {
            id = sc.nextInt();
            sc.nextLine();
        }
        catch (InputMismatchException e) {
            System.out.println("Invalid ID. Please enter a number.");
            sc.nextLine();
            return;
        }


        // Title
        System.out.print("Enter Title: ");
        String title = sc.nextLine();

        if (title.trim().isEmpty()) {
            System.out.println("Title cannot be empty.");
            return;
        }


        // Subject
        System.out.print("Enter Subject: ");
        String subject = sc.nextLine();

        if (subject.trim().isEmpty()) {
            System.out.println("Subject cannot be empty.");
            return;
        }


        // Deadline
        System.out.print("Enter Deadline (dd/MM/yyyy): ");
        String deadline = sc.nextLine();

        if (deadline.trim().isEmpty()) {
            System.out.println("Deadline cannot be empty.");
            return;
        }


        // Convert deadline into LocalDate
        LocalDate date;

        try {

            DateTimeFormatter formatter =
                    DateTimeFormatter.ofPattern("dd/MM/yyyy");

            date = LocalDate.parse(deadline, formatter);

        }
        catch (Exception e) {

            System.out.println("Invalid date format.");
            System.out.println("Please use dd/MM/yyyy.");
            return;
        }


        // Status
        System.out.println("\nSelect Status:");
        System.out.println("1. Pending");
        System.out.println("2. Completed");
        System.out.print("Choose: ");

        int statusChoice;

        try {

            statusChoice = sc.nextInt();
            sc.nextLine();

        }
        catch (InputMismatchException e) {

            System.out.println(
                    "Invalid choice. Please enter 1 or 2."
            );

            sc.nextLine();
            return;
        }


        String status;

        if (statusChoice == 1) {

            status = "Pending";

        }
        else if (statusChoice == 2) {

            status = "Completed";

        }
        else {

            System.out.println(
                    "Invalid choice. Please select 1 or 2."
            );

            return;
        }


        // SQL INSERT
        String sql =
                "INSERT INTO assignments " +
                "(id, title, subject, deadline, status) " +
                "VALUES (?, ?, ?, ?, ?)";


        try (
                Connection connection =
                        DatabaseManager.getConnection();
                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

            statement.setInt(1, id);
            statement.setString(2, title);
            statement.setString(3, subject);

            statement.setDate(
                    4,
                    java.sql.Date.valueOf(date)
            );

            statement.setString(5, status);


            statement.executeUpdate();


            System.out.println(
                    "\nAssignment added successfully!"
            );

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }



    // =========================================================
    // 2. VIEW ALL ASSIGNMENTS
    // =========================================================

    public static void viewAllAssignments() {

        String sql =
                "SELECT * FROM assignments";


        try (
                Connection connection =
                        DatabaseManager.getConnection();
                PreparedStatement statement =
                        connection.prepareStatement(sql);
                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean found = false;


            while (result.next()) {

                found = true;

                System.out.println(
                        "\n========================================"
                );

                System.out.println(
                        "ID       : " +
                        result.getInt("id")
                );

                System.out.println(
                        "Title    : " +
                        result.getString("title")
                );

                System.out.println(
                        "Subject  : " +
                        result.getString("subject")
                );

                System.out.println(
                        "Deadline : " +
                        result.getDate("deadline")
                );

                System.out.println(
                        "Status   : " +
                        result.getString("status")
                );

                System.out.println(
                        "========================================"
                );
            }


            if (!found) {

                System.out.println(
                        "No assignments available."
                );
            }

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }



    // =========================================================
    // 3. SEARCH ASSIGNMENT
    // =========================================================

    public static void searchAssignment(Scanner sc) {

        System.out.print(
                "Enter Assignment ID: "
        );


        int id;

        try {

            id = sc.nextInt();

        }
        catch (InputMismatchException e) {

            System.out.println(
                    "Invalid ID. Please enter a number."
            );

            sc.nextLine();
            return;
        }


        String sql =
                "SELECT * FROM assignments WHERE id = ?";


        try (
                Connection connection =
                        DatabaseManager.getConnection();
                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

            statement.setInt(1, id);

            try (ResultSet result = statement.executeQuery()) {

                if (result.next()) {

                    System.out.println(
                            "\n========================================"
                    );

                    System.out.println(
                            "ID       : " +
                            result.getInt("id")
                    );

                    System.out.println(
                            "Title    : " +
                            result.getString("title")
                    );

                    System.out.println(
                            "Subject  : " +
                            result.getString("subject")
                    );

                    System.out.println(
                            "Deadline : " +
                            result.getDate("deadline")
                    );

                    System.out.println(
                            "Status   : " +
                            result.getString("status")
                    );

                    System.out.println(
                            "========================================"
                    );

                }
                else {

                    System.out.println(
                            "Assignment not found."
                    );
                }
            }

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }



    // =========================================================
    // 4. MARK AS COMPLETED
    // =========================================================

    public static void markAsCompleted(Scanner sc) {

        System.out.print(
                "Enter Assignment ID: "
        );


        int id;

        try {

            id = sc.nextInt();

        }
        catch (InputMismatchException e) {

            System.out.println(
                    "Invalid ID. Please enter a number."
            );

            sc.nextLine();
            return;
        }


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

                System.out.println(
                        "Assignment marked as completed! \u2705"
                );

            }
            else {

                System.out.println(
                        "Assignment not found."
                );
            }

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }



    // =========================================================
    // 5. DELETE ASSIGNMENT
    // =========================================================

    public static void deleteAssignment(Scanner sc) {

        System.out.print(
                "Enter Assignment ID: "
        );


        int id;

        try {

            id = sc.nextInt();

        }
        catch (InputMismatchException e) {

            System.out.println(
                    "Invalid ID. Please enter a number."
            );

            sc.nextLine();
            return;
        }


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

                System.out.println(
                        "Assignment removed successfully!"
                );

            }
            else {

                System.out.println(
                        "Assignment not found."
                );
            }

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }



    // =========================================================
    // 6. SHOW PENDING ASSIGNMENTS
    // =========================================================

    public static void showPendingAssignments() {

        String sql =
                "SELECT * FROM assignments " +
                "WHERE status = 'Pending'";


        try (
                Connection connection =
                        DatabaseManager.getConnection();
                PreparedStatement statement =
                        connection.prepareStatement(sql);
                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean found = false;


            while (result.next()) {

                found = true;

                System.out.println(
                        "\n========================================"
                );

                System.out.println(
                        "ID       : " +
                        result.getInt("id")
                );

                System.out.println(
                        "Title    : " +
                        result.getString("title")
                );

                System.out.println(
                        "Subject  : " +
                        result.getString("subject")
                );

                System.out.println(
                        "Deadline : " +
                        result.getDate("deadline")
                );

                System.out.println(
                        "Status   : " +
                        result.getString("status")
                );

                System.out.println(
                        "========================================"
                );
            }


            if (!found) {

                System.out.println(
                        "No pending assignments."
                );
            }

        }
        catch (SQLException e) {

            System.out.println("Database error!");
            System.out.println(e.getMessage());
        }
    }
        // =========================================================
        // 7. SHOW UPCOMING ASSIGNMENTS
        // =========================================================

        public static void showUpcomingAssignments() {

        LocalDate today = LocalDate.now();
        LocalDate nextWeek = today.plusDays(7);

        String sql =
                "SELECT * FROM assignments " +
                "WHERE status = 'Pending' " +
                "AND deadline BETWEEN ? AND ? " +
                "ORDER BY deadline";

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

                statement.setDate(
                        1,
                        java.sql.Date.valueOf(today)
                );

                statement.setDate(
                        2,
                        java.sql.Date.valueOf(nextWeek)
                );

                try (ResultSet result = statement.executeQuery()) {

                boolean found = false;

                while (result.next()) {

                        found = true;

                        System.out.println(
                                "\n========================================"
                        );

                        System.out.println(
                                "ID       : " +
                                result.getInt("id")
                        );

                        System.out.println(
                                "Title    : " +
                                result.getString("title")
                        );

                        System.out.println(
                                "Subject  : " +
                                result.getString("subject")
                        );

                        System.out.println(
                                "Deadline : " +
                                result.getDate("deadline")
                        );

                        System.out.println(
                                "Status   : " +
                                result.getString("status")
                        );

                        System.out.println(
                                "========================================"
                        );
                }

                if (!found) {
                        System.out.println(
                                "No upcoming assignments."
                        );
                }
                }

        }
        catch (SQLException e) {

                System.out.println("Database error!");
                System.out.println(e.getMessage());
        }
        }
}

import java.util.Scanner;

public class Main {

    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);

        int choice;

        do {
            System.out.println("\n========================================");
            System.out.println("       ASSIGNMENT & DEADLINE TRACKER");
            System.out.println("========================================");
            System.out.println("1. Add Assignment");
            System.out.println("2. View All Assignments");
            System.out.println("3. Search Assignment");
            System.out.println("4. Mark as Completed");
            System.out.println("5. Delete Assignment");
            System.out.println("6. Show Pending Assignments");
            System.out.println("7. Show Upcoming Assignments");
            System.out.println("8. Exit");
            System.out.println("========================================");

            System.out.print("Enter your choice: ");
            choice = sc.nextInt();

            switch (choice) {

                case 1:
                    AssignmentManager.addAssignment(sc);
                    break;

                case 2:
                    AssignmentManager.viewAllAssignments();
                    break;

                case 3:
                    AssignmentManager.searchAssignment(sc);
                    break;

                case 4:
                    AssignmentManager.markAsCompleted(sc);
                    break;

                case 5:
                    AssignmentManager.deleteAssignment(sc);
                    break;

                case 6:
                    AssignmentManager.showPendingAssignments();
                    break;

                case 7:
                    AssignmentManager.showUpcomingAssignments();
                    break;

                case 8:
                    System.out.println("Exiting program...");
                    break;

                default:
                    System.out.println(
                            "Invalid choice. Please enter a number from 1 to 8."
                    );
            }

        } while (choice != 8);

        sc.close();
    }
}
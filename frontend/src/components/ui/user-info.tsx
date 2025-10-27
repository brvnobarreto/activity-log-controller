import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

export function UserInfo({
  user,
}: {
  user: {
    role: string;
  };
  }) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src="/unifor-logo.svg" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">Activity Log Controller</span>
          <span className="truncate text-xs">{user.role}</span>
        </div>
      </div>
    );
  }